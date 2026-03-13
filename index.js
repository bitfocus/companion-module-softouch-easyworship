const { InstanceBase, runEntrypoint, TCPHelper } = require('@companion-module/base')
const { Bonjour } = require('bonjour-service')
const { randomUUID, createHash } = require('crypto')
const { sendCommand, actions } = require('./actions')
const { getConfigFields } = require('./config.js')
const { getFeedbacks } = require('./feedbacks')
const { getPresets } = require('./presets')
const { getVariables } = require('./variables')
const net = require('net')

// Prevents DoS via a malicious server sending data without \r\n delimiters
const MAX_BUFFER_SIZE = 1024 * 1024

// Reconnection: relentlessly aggressive. A church tech should never have to
// manually reconnect — the module should be so persistent that you'd have to
// go out of your way to stop it from connecting.
const RETRY_BASE_MS = 1000
const RETRY_MAX_MS = 5000
const RETRY_VERBOSE_THRESHOLD = 5

// Send a heartbeat every 30s to keep the connection alive and detect dead
// sockets. EW doesn't send data while idle — that's normal, not a failure.
// If the heartbeat send fails, the TCP error handler will trigger reconnection.
const KEEPALIVE_INTERVAL_MS = 30000

// Actions we know how to fully process. Unknown actions still get heartbeat
// responses and requestrev processing — this keeps us forward-compatible if
// a future EW version adds new action types we haven't seen yet.
const KNOWN_ACTIONS = new Set(['paired', 'notPaired', 'status', 'heartbeat'])

class EasyWorshipInstance extends InstanceBase {

	constructor(internal) {
		super(internal)

		this.paired = false
		this.config = {}
		this.socket = null
		this.connected = false
		this.ezw = []
		this.EZWLogo = 0
		this.EZWBlack = 0
		this.EZWClear = 0
		this.EZWLivePreview = 0
		this.previousEWServer = ''
		this.retryTimeout = null
		this.retryAttempts = 0
		this.bonjour = null
		this.browser = null
		this._receiveBuffer = ''
		this._keepaliveInterval = null
	}

	async init(config) {
		try {
			this.config = config || {}
			this.updateStatus('connecting')

			// Generate a stable UUID for this Companion instance — EW uses it
			// to identify and remember paired devices across sessions
			let configUpdated = false
			if (this.config.EWServer === undefined) {
				this.config.EWServer = ''
				configUpdated = true
			}
			if (this.config.UUID === undefined) {
				this.config.UUID = randomUUID()
				configUpdated = true
			}
			if (configUpdated) {
				this.saveConfig(this.config)
			}

			// Log truncated hash of UUID — enough to identify in logs without
			// exposing the full pairing credential
			const uuidHash = createHash('sha256').update(this.config.UUID).digest('hex').slice(0, 8)
			this.log('info', `UUID=${uuidHash}...`)
			this.log('info', `Last EasyWorship Server=${this.config.EWServer}`)
			this.log('info', `ID=${this.id}`)

			this.connected = false
			this.paired = false
			this.ezw = []
			// Track which server we're configured for so configUpdated can
			// detect when the user actually switches servers vs just re-saving
			this.previousEWServer = this.config.EWServer || ''

			this.initFeedbacks()
			this.initVariables()
			this.initPresets()
			this.initActions()

			// Try the last known good server immediately — don't wait for
			// Bonjour to rediscover it. Discovery runs in parallel to catch
			// address changes or new servers, but the common case (same server,
			// same address) should connect in under a second.
			if (this.config.EWServer && this.config.EWAddr && this.config.EWPort) {
				this.log('info', `Trying last known server: ${this.config.EWServer} at ${this.config.EWAddr}:${this.config.EWPort}`)
				this.ezw.push(this.config.EWServer)
				this.connectTCP()
			}

			this.startDiscovery()
		} catch (error) {
			this.log('error', `Initialization failed: ${error.message}`)
			this.updateStatus('connection_failure', 'Initialization failed')
		}
	}

	async destroy() {
		this.clearRetry()
		this.clearKeepalive()
		this.destroySocket()
		this.stopDiscovery()
	}

	clearRetry() {
		if (this.retryTimeout) {
			clearTimeout(this.retryTimeout)
			this.retryTimeout = null
		}
	}

	destroySocket() {
		if (this.socket) {
			this.socket.destroy()
			this.socket = null
		}
		this.connected = false
		this.paired = false
		this._receiveBuffer = ''
		this.setVariableValues({ Connected: 0 })
		this.checkFeedbacks()
	}

	/**
	 * Clears all EW display state — used when switching servers so that
	 * Building A's button highlights don't bleed into Building B's session.
	 */
	resetDisplayState() {
		this.EZWLogo = 0
		this.EZWBlack = 0
		this.EZWClear = 0
		this.EZWLivePreview = 0
		this.rectype = undefined
		this.pres_rowid = undefined
		this.slide_rowid = undefined
		this.pres_no = undefined
		this.slide_no = undefined
		this.schedulerev = undefined
		this.liverev = undefined
		this.imagehash = undefined
		this.permissions = undefined
		this.requestrev = undefined

		this.setVariableValues({
			Logo: 0,
			Black: 0,
			Clear: 0,
			LivePreview: 0,
			Connected: 0,
		})
		this.checkFeedbacks()
	}

	stopDiscovery() {
		if (this.browser) {
			this.browser.stop()
			this.browser = null
		}
		if (this.bonjour) {
			this.bonjour.destroy()
			this.bonjour = null
		}
	}

	async configUpdated(config) {
		this.config = config || {}
		// Config dropdown ID is 'EWServers', normalize to 'EWServer' for internal use
		this.config.EWServer = this.config.EWServers || ''
		this.log('info', `Selected EasyWorship Server: ${this.config.EWServer}`)
		this.saveConfig(this.config)

		if (this.config.EWServer !== this.previousEWServer) {
			this.previousEWServer = this.config.EWServer
			this.clearRetry()
			this.clearKeepalive()
			this.destroySocket()
			this.resetDisplayState()
			this.stopDiscovery()
			this.retryAttempts = 0
			this.startDiscovery()
		} else if (!this.connected && !this.paired) {
			// User saved config but we're not connected — make sure we're
			// actively trying. Don't just sit there.
			this.startDiscovery()
			if (!this.retryTimeout && this.config.EWAddr && this.config.EWPort) {
				this.connectTCP()
			}
		}
	}

	getConfigFields() {
		return getConfigFields(this)
	}

	/**
	 * Pushes updated config fields to Companion's UI — call this after
	 * the server list changes so the dropdown reflects discovered servers.
	 */
	updateConfigFields() {
		this.setConfigFields(this.getConfigFields())
	}

	initFeedbacks() {
		this.setFeedbackDefinitions(getFeedbacks(this))
	}

	initVariables() {
		const { definitions, initialValues } = getVariables()
		this.setVariableDefinitions(definitions)
		this.setVariableValues(initialValues)
	}

	initPresets() {
		this.setPresetDefinitions(getPresets(this))
	}

	/**
	 * Binds action definitions to this instance. The actions are defined
	 * as arrow functions in actions.js that reference `this` — we need to
	 * bind each callback so `this` points to the EasyWorshipInstance.
	 */
	initActions() {
		const actionDefinitions = actions.call(this)
		this.sendCommand = sendCommand.bind(this)

		const boundActions = {}
		for (const [actionId, actionDef] of Object.entries(actionDefinitions)) {
			boundActions[actionId] = {
				...actionDef,
				callback: (...args) => actionDef.callback.call(this, ...args),
			}
		}
		this.setActionDefinitions(boundActions)
	}

	isValidAddress(address, port) {
		if (!address || !port) return false
		if (net.isIP(address) === 0) return false
		const portNum = Number(port)
		if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) return false
		return true
	}

	/**
	 * Starts mDNS discovery for EasyWorship servers on the local network.
	 * Creates ONE Bonjour instance and lets it run persistently — do NOT
	 * cycle or restart it. Bonjour needs a stable listener to receive
	 * multicast responses. Tearing it down and recreating it prevents
	 * discovery from working.
	 *
	 * The browser emits 'up' events as servers appear and 'down' events
	 * when they disappear. When a matching server is found, we connect
	 * automatically. If no server is configured, we auto-select the first one.
	 */
	startDiscovery() {
		// Don't restart if already running — the whole point is persistence
		if (this.bonjour) return

		this.bonjour = new Bonjour()
		this.log('info', 'Searching for EasyWorship Servers...')

		try {
			this.browser = this.bonjour.find({ type: 'ezwremote', protocol: 'tcp' }, (service) => {
				if (!service || service.type !== 'ezwremote' || !service.name || !service.port) return

				const serverName = service.name
				const address = service.addresses?.[0] || service.referer?.address || null

				if (!this.ezw.includes(serverName)) {
					this.ezw.push(serverName)
					this.log('info', `Discovered EasyWorship server: ${serverName}`)
					this.updateConfigFields()
				}

				if (!this.isValidAddress(address, service.port)) {
					this.log('warn', `Invalid address/port for server: ${serverName}`)
					return
				}

				// Auto-select: if no server is configured, grab the first valid one.
				// If a server IS configured, reconnect to it when rediscovered.
				// Typical church has one EW machine — don't make the tech pick manually.
				const shouldConnect = this.config.EWServer
					? serverName.trim().toLowerCase() === this.config.EWServer.trim().toLowerCase()
					: true

				if (shouldConnect && !this.connected) {
					if (this.config.EWAddr && this.config.EWAddr !== address) {
						this.log('warn', `Server address changed for ${serverName} (was ${this.config.EWAddr}, now ${address})`)
					}

					this.config.EWServer = serverName
					this.config.EWServers = serverName
					this.config.EWAddr = address
					this.config.EWPort = service.port
					this.previousEWServer = serverName
					this.log('info', `Connecting to EasyWorship server: ${serverName}`)
					this.saveConfig(this.config)
					this.connectTCP()
				}
			})

			this.browser.on('down', (service) => {
				if (!service?.name) return

				const index = this.ezw.indexOf(service.name)
				if (index !== -1) {
					this.ezw.splice(index, 1)
					this.log('info', `Removed EasyWorship server: ${service.name}`)
					this.updateConfigFields()
				}

				if (this.config.EWServer === service.name) {
					this.log('warn', `Lost connection to selected server: ${service.name}`)
					this.destroySocket()
					this.updateStatus('disconnected', 'Lost connection to EasyWorship server')
					this.scheduleReconnect()
				}
			})

			this.browser.on('error', (err) => {
				this.log('error', `Bonjour error: ${err.message}`)
				this.updateStatus('error', 'Bonjour discovery failed')
			})
		} catch (err) {
			this.log('error', `Failed to initialize Bonjour: ${err.message}`)
			this.updateStatus('error', 'Bonjour initialization failed')
		}
	}

	scheduleReconnect() {
		if (this.retryTimeout) return

		// Backoff: 1s → 1.5s → 2.3s → 3.4s → 5s (cap), then 5s forever.
		// Relentlessly aggressive — the user should never notice a disconnect.
		const delay = Math.min(RETRY_BASE_MS * Math.pow(1.5, this.retryAttempts), RETRY_MAX_MS)
		this.retryAttempts++

		if (this.retryAttempts <= RETRY_VERBOSE_THRESHOLD) {
			this.log('info', `Reconnect attempt ${this.retryAttempts} in ${Math.round(delay / 1000)}s...`)
		} else if (this.retryAttempts % 20 === 0) {
			this.log('info', `Still trying to reconnect (attempt ${this.retryAttempts})...`)
		}

		this.retryTimeout = setTimeout(() => {
			this.retryTimeout = null

			if (this.connected && this.paired) {
				this.retryAttempts = 0
				return
			}

			// Make sure discovery is running (it's persistent, won't restart if already up)
			this.startDiscovery()

			if (this.config.EWAddr && this.config.EWPort) {
				this.connectTCP()
			}

			// Keep retrying until we're connected and paired
			this.scheduleReconnect()
		}, delay)
	}

	/**
	 * Sends periodic heartbeats to keep the connection alive. EW doesn't
	 * send data while idle — that's normal behavior, not a failure. If the
	 * TCP socket dies (network change, EW crash), the send will fail and
	 * trigger the error handler which reconnects.
	 */
	startKeepalive() {
		this.clearKeepalive()
		this._keepaliveInterval = setInterval(() => {
			if (this.connected && this.paired) {
				this.socketSend(JSON.stringify({
					action: 'heartbeat',
					requestrev: this.requestrev,
				}))
			}
		}, KEEPALIVE_INTERVAL_MS)
	}

	clearKeepalive() {
		if (this._keepaliveInterval) {
			clearInterval(this._keepaliveInterval)
			this._keepaliveInterval = null
		}
	}

	connectTCP() {
		this.clearRetry()
		this.clearKeepalive()
		this.destroySocket()

		if (!this.config.EWServer) {
			this.log('info', 'No EasyWorship server selected. Waiting for configuration.')
			this.updateStatus('bad_config', 'No EasyWorship server selected')
			return
		}

		if (!this.isValidAddress(this.config.EWAddr, this.config.EWPort)) {
			this.log('info', 'Server address not resolved or invalid. Waiting for discovery...')
			this.scheduleReconnect()
			return
		}

		this.socket = new TCPHelper(this.config.EWAddr, this.config.EWPort)

		this.socket.on('status_change', (status, message) => {
			this.updateStatus(status, message)
		})

		this.socket.on('error', (err) => {
			this.log('error', `TCP error: ${err.message}`)
			this.updateStatus('connection_failure', err.message)
			this.connected = false
			this.paired = false
			this.clearKeepalive()
			this.setVariableValues({ Connected: 0 })
			this.checkFeedbacks()
			this.scheduleReconnect()
		})

		this.socket.on('connect', () => {
			if (this.connected) return

			if (!this.config.ClientName) {
				this.updateStatus('bad_config', 'Missing Name in configuration')
				return
			}

			this.connected = true
			this.updateStatus('ok')
			this.log('info', `Connected to EasyWorship server: ${this.config.EWServer}`)

			// Send the pairing request — EW will respond with 'paired' or 'notPaired'.
			// On first connection, the user must approve pairing on the EW machine.
			// On subsequent connections with the same UUID, EW auto-accepts.
			const sanitizedName = this.config.ClientName.replace(/[\x00-\x1f]/g, '').slice(0, 64)

			this.socketSend(JSON.stringify({
				action: 'connect',
				uid: this.config.UUID,
				device_name: sanitizedName,
				device_type: 8,
				requestrev: '0',
			}))
		})

		this.socket.on('close', () => {
			this.log('warn', 'Connection lost. Will retry...')
			this.updateStatus('connection_failure', 'Connection lost')
			this.connected = false
			this.paired = false
			this._receiveBuffer = ''
			this.clearKeepalive()
			this.setVariableValues({ Connected: 0 })
			this.checkFeedbacks()
			this.scheduleReconnect()
		})

		this.socket.on('data', (data) => {
			this.handleSocketData(data)
		})
	}

	socketSend(cmd) {
		const buf = Buffer.from(cmd + '\r\n', 'latin1')
		if (this.socket?.isConnected) {
			this.socket.send(buf).catch((err) => {
				this.log('error', `Send failed: ${err.message}`)
			})
		}
	}

	/**
	 * Processes incoming TCP data from EasyWorship. Data arrives as a byte
	 * stream — messages are \r\n delimited JSON objects, but TCP can split
	 * them across multiple data events. We buffer until we have complete lines.
	 */
	handleSocketData(data) {
		this._receiveBuffer += data.toString()

		if (this._receiveBuffer.length > MAX_BUFFER_SIZE) {
			this.log('error', `Receive buffer exceeded ${MAX_BUFFER_SIZE} bytes. Dropping connection.`)
			this._receiveBuffer = ''
			this.destroySocket()
			this.updateStatus('connection_failure', 'Server sent oversized data')
			this.scheduleReconnect()
			return
		}

		const lines = this._receiveBuffer.split('\r\n')
		// Last element is either an incomplete line or empty string — keep in buffer
		this._receiveBuffer = lines.pop()

		for (const line of lines) {
			if (!line.trim()) continue

			try {
				const command = JSON.parse(line)

				const action = typeof command.action === 'string' ? command.action : null
				if (!action) {
					this.log('warn', 'Received message with no action field')
					continue
				}

				// Always process requestrev — even from unknown action types —
				// so we stay in sync with EW's sequence numbering
				if (command.requestrev !== undefined) {
					const revType = typeof command.requestrev
					if (revType === 'string' || revType === 'number') {
						this.requestrev = String(command.requestrev)
					}
				}

				if (!KNOWN_ACTIONS.has(action)) {
					// Forward-compatible: future EW versions may add action types
					// we don't understand yet. Log at debug (not warn) to avoid
					// spamming, but still send a heartbeat to keep the connection alive.
					this.log('debug', `Unrecognized action from server: ${action}`)
					this.socketSend(JSON.stringify({
						action: 'heartbeat',
						requestrev: this.requestrev,
					}))
					continue
				}

				if (action === 'notPaired') {
					// EW doesn't recognize us — user needs to approve pairing
					// on the EW machine, or our UUID changed
					this.updateStatus('unknown_error', `Not paired with ${this.config.EWServer}`)
					this.log('warn', `Not paired with ${this.config.EWServer}`)
					this.paired = false
					this.setVariableValues({ Connected: 0 })
				} else if (action === 'paired') {
					// EW accepted our pairing — we're fully operational
					this.updateStatus('ok')
					this.log('info', `Paired with ${this.config.EWServer}`)
					this.paired = true
					this.retryAttempts = 0
					this.clearRetry()
					this.startKeepalive()
					this.setVariableValues({ Connected: 1 })
				} else if (action === 'status') {
					// EW sends periodic status updates with the current display state.
					// This is the source of truth — it corrects any optimistic local state.
					this.updateStatus('ok')

					this.EZWLogo = command.logo === true ? 1 : 0
					this.EZWBlack = command.black === true ? 1 : 0
					this.EZWClear = command.clear === true ? 1 : 0

					this.setVariableValues({
						Logo: this.EZWLogo,
						Black: this.EZWBlack,
						Clear: this.EZWClear,
						LivePreview: this.EZWLivePreview,
					})

					// These fields are echoed back in status commands (logo/black/clear
					// toggles). EW requires the full current state in each status payload,
					// so we store them for buildStatusPayload() in actions.js.
					if (typeof command.rectype === 'number') this.rectype = command.rectype
					if (typeof command.pres_rowid === 'number') this.pres_rowid = command.pres_rowid
					if (typeof command.slide_rowid === 'number') this.slide_rowid = command.slide_rowid
					if (typeof command.pres_no === 'number') this.pres_no = command.pres_no
					if (typeof command.slide_no === 'number') this.slide_no = command.slide_no
					if (typeof command.schedulerev === 'string' || typeof command.schedulerev === 'number') this.schedulerev = command.schedulerev
					if (typeof command.liverev === 'string' || typeof command.liverev === 'number') this.liverev = command.liverev
					if (typeof command.imagehash === 'string') this.imagehash = command.imagehash
					if (typeof command.permissions === 'number' || typeof command.permissions === 'string') this.permissions = command.permissions
				}

				// Heartbeat keeps the connection alive. Don't send one for
				// notPaired — EW would reject it and we'd create a noisy loop.
				if (action !== 'notPaired') {
					this.socketSend(JSON.stringify({
						action: 'heartbeat',
						requestrev: this.requestrev,
					}))
				}
			} catch (err) {
				this.log('error', `Failed to parse message: ${err.message}`)
			}
		}

		this.checkFeedbacks()
	}
}

runEntrypoint(EasyWorshipInstance, [])
