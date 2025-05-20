const { InstanceBase, runEntrypoint, TCPHelper, combineRgb } = require('@companion-module/base')
const Bonjour = require('bonjour-service').Bonjour
const { randomUUID } = require('crypto');
const { sendCommand, actions } = require('./actions')
const { getConfigFields } = require('./config.js');
const { getFeedbacks } = require('./feedbacks');
const { getPresets } = require('./presets')
const { getVariables } = require('./variables');

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
		this.retryInterval = null 
		
		Object.assign(this, {
			...actions,
		})	
				
	}	
	
	uuidv4() {
		return randomUUID();
	}  

	async init(config) {		

		try {
			this.config = config || {}
			this.updateStatus('connecting')

			let configUpdated = false
			if (this.config.EWServer === undefined) {
				this.config.EWServer = ''
				configUpdated = true
			}
			if (this.config.UUID === undefined) {
				this.config.UUID = this.uuidv4()
				configUpdated = true
			}

			if (configUpdated) {
				this.saveConfig(this.config)
			}

			this.log('info', 'UUID=' + this.config.UUID);
			this.log('info', 'Last EasyWorship Server=', this.config.EWServer);
			this.log('info', 'ID=' + this.id);

			this.connected = false;
			this.ezw = [];

			this.initFeedbacks()
			this.initVariables()
			this.initPresets()
			this.initActions()
			this.initBonjour(() => {
				this.initTCP();
			});
		} 
		catch (error) {
			this.log('info', `Initialization failed: ${error.message}`)
    		this.updateStatus('connection_failure', 'Initialization failed')
		}
	}

	async destroy() {
		// Clear retry interval if it exists
		if (this.retryInterval) {
			clearInterval(this.retryInterval);
			this.retryInterval = null;
		}

		// Stop the Bonjour browser if it exists
		if (this.browser) {
			this.browser.stop();
		}

		// Destroy the Bonjour instance if it exists
		if (bonjour) {
			bonjour.destroy();
		}

		if (this.socket) {
			this.socket.destroy()
			this.socket = null
		}
	}

	async configUpdated(config) {
		this.config = config || {}
		
		this.config.EWServer = this.config.EWServers || '' // Fallback to empty string if undefined
		this.log('info', `Selected EasyWorship Server: ${this.config.EWServer}`)
		this.saveConfig(this.config)

		// Reset and reconnect only if needed
		if (this.config.EWServer !== this.previousEWServer) {
			this.previousEWServer = this.config.EWServer

			if (this.socket) {
				this.socket.destroy()
				this.socket = null
				this.connected = false
			}

			// Clear retry interval if switching servers
			if (this.retryInterval) {
				clearInterval(this.retryInterval);
				this.retryInterval = null;
			}

			this.ezw = []
			this.initBonjour(() => {
				this.initTCP();
			});
		} 
		else {
			this.updateStatus('ok')
		}
	}

	getConfigFields() {
		return getConfigFields(this);
	}

	initFeedbacks() {
		const feedbacks = getFeedbacks(this);
		this.setFeedbackDefinitions(feedbacks);
	}

	initVariables() {
		const { definitions, initialValues } = getVariables(); 
		this.setVariableDefinitions(definitions);
		this.setVariableValues(initialValues);
	}

	initPresets() {
		const presets = getPresets(this);    
		this.setPresetDefinitions(presets)
	}

	initActions() {		
		const actionDefinitions = actions.call(this); // Initialize actions with the correct context
		this.sendCommand = sendCommand.bind(this); // Bind sendCommand to the instance
		
		const boundActions = {};
		for (const [actionId, actionDef] of Object.entries(actionDefinitions)) {
			boundActions[actionId] = {
				...actionDef,
				callback: (...args) => actionDef.callback.call(this, ...args),
			};
		}
		
		this.setActionDefinitions(boundActions);
	}

	updateConfigFields() {
        this.setConfigFields(this.getConfigFields());
    }

	initBonjour(callback) {
		const bonjour = new Bonjour();
		this.ezw = [];
		this.log('info', 'Searching for EasyWorship Servers...');

		try {
			this.browser = bonjour.find({ type: 'ezwremote', protocol: 'tcp' }, (service) => {
				if (service && service.type === 'ezwremote') {
					if (service.name && service.port) {
						const serverName = service.name;

						if (!this.ezw.includes(serverName)) {
							this.ezw.push(serverName);
							this.log('info', `Discovered EasyWorship server: ${serverName}`);
							
							const address = (service.addresses?.[0]) || (service.referer?.address) || null;
							this.log('info', `Comparing config.EWServer="${this.config.EWServer}" to serverName="${serverName}", address="${address}"`);
							
							if (this.config.EWServer && (serverName.trim().toLowerCase() === this.config.EWServer.trim().toLowerCase()) && address) {
								this.config.EWServer = serverName;
								this.config.EWAddr = address;
								this.config.EWPort = service.port;
								this.log('info',`Selected EasyWorship server: ${serverName} at ${this.config.EWAddr}:${this.config.EWPort}`);
								this.saveConfig(this.config);

								if (callback) callback();
							} else {
								this.log('info', `No valid IP address found for server: ${serverName}`);
							}
						}
					}
				}
			});

			this.browser.on('up', (service) => {
				this.log('info', `Service up: ${JSON.stringify(service)}`);
			});

			this.browser.on('down', (service) => {
				if (service && service.name) {
					const index = this.ezw.indexOf(service.name);
					if (index !== -1) {
						this.ezw.splice(index, 1);
						this.log('info', `Removed EasyWorship server: ${service.name}`);
					}

					if (this.config.EWServer === service.name) {
						this.log('warn', `Lost connection to selected EasyWorship server: ${service.name}`);
						this.paired = false;
						this.updateStatus('disconnected', 'Lost connection to EasyWorship server');
						this.initTCP();
					}
				}
			});

			this.browser.on('error', (err) => {
				this.log('error', `Bonjour error: ${err.message}`);
				this.paired = false
				this.updateStatus('error', 'Bonjour discovery failed');
				this.initTCP();
			});
		} catch (err) {
			this.log('error', `Failed to initialize Bonjour: ${err.message}`);
			this.paired = false
			this.updateStatus('error', 'Bonjour initialization failed');
		}
	}

	startRetry() {
		if (this.retryInterval) return;
		this.retryInterval = setInterval(() => {
			if (!this.connected) {
				this.log('info', 'Retrying connection to EasyWorship...');
				this.initTCP();
			} else {
				clearInterval(this.retryInterval);
				this.retryInterval = null;
			}
		}, 5000);
	}

	initTCP() {
		// Clear any existing retry interval
		if (this.retryInterval) {
			clearInterval(this.retryInterval);
			this.retryInterval = null;
		}

		if (this.socket) {
			this.socket.destroy();
			this.socket = null;
		}		

		if (!this.config.EWServer || this.config.EWServer === '') {
			this.log('info', 'No EasyWorship server selected. Waiting for configuration.');
			this.updateStatus('bad_config', 'No EasyWorship server selected');
			return;
		}

		if (!this.config.EWAddr || this.config.EWAddr === '' || !this.config.EWPort || this.config.EWPort === '') {
			this.log('info', 'EasyWorship server address or port is not configured. Rediscovering servers...');
			this.initBonjour(() => {});
			return;
		}

		this.socket = new TCPHelper(this.config.EWAddr, this.config.EWPort)

		this.socket.on('status_change', (status, message) => {
			this.log('info', `initTcp status change: ${status} message: ${message}`)
			this.updateStatus(status, message)
		})

		this.socket.on('error', (err) => {
			this.log('error', `initTCP err: ${JSON.stringify(err)}`);
			this.updateStatus('connection_failure', err.message);
			this.paired = false;
			this.connected = false;
			this.startRetry();
		})

		this.socket.on('connect', () => {
			if (this.connected) {
				return;
			}

			if (!this.config.ClientName) {
				this.updateStatus('bad_config', 'Missing Name in configuration');
				return;
			}

			this.updateStatus('ok');
			this.log('info', `Connected to EasyWorship server at ${this.config.EWAddr}:${this.config.EWPort}`);
			this.connected = true;

			const cmd = `{"action":"connect", "uid":"${this.config.UUID}", "device_name":"${this.config.ClientName}", "device_type":8, "requestrev":"0"}`;
			const sendBuf = Buffer.from(cmd + '\r\n', 'latin1');
			if (this.socket && this.socket.isConnected) {
				this.socket.send(sendBuf).catch((err) => {
					this.log('info', `Failed to send command: ${err.message}`);
				});
			}
		})

		this.socket.on('close', () => {
			this.log('error', 'Connection to EasyWorship server lost. Attempting to reconnect...');
			this.updateStatus('connection_failure', 'Connection to EasyWorship server lost');
			this.connected = false;
			this.paired = false;
			this.startRetry();
			this.initBonjour(() => {});
		})

		this.socket.on('data', (data) => {
			this.handleSocketData(data)
		})
	}

	handleSocketData(data) {
		try {
			const json = data.toString();
			const cmds = json.split('\r\n');
			for (let i = 0; i < cmds.length - 1; i++) {
				let cmd = cmds[i].toString();
				cmd = cmd.split('\r\n')[0];
				const command = JSON.parse(cmd);
				this.requestrev = command['requestrev'];
				const action = command['action'];

				if (action === 'notPaired') {
					this.updateStatus('unknown_error', 'Not paired with ' + this.config.EWServer);
					this.log('info', 'Not paired with ' + this.config.EWServer);
    				this.paired = false; // <-- Unset paired flag
					this.config.paired = false;
				} else if (action === 'paired') {
					this.updateStatus('ok');
					this.log('info', 'Paired with ' + this.config.EWServer);
    				this.paired = true; // <-- Set paired flag
					this.config.paired = true;
				} else if (action === 'status') {
					this.updateStatus('ok');
					this.log('info', 'Received status of ' + this.config.EWServer);

					this.EZWLogo = command['logo'] ? 1 : 0;
					this.EZWBlack = command['black'] ? 1 : 0;
					this.EZWClear = command['clear'] ? 1 : 0;
					//this.EZWLivePreview = 0;
					this.setVariableValues({
						'Logo': this.EZWLogo,
						'Black': this.EZWBlack,
						'Clear': this.EZWClear,
						'LivePreview': this.EZWLivePreview
					})

					// Pickup values to send for logo/black/clear actions
					this.rectype = command['rectype'];
					this.pres_rowid = command['pres_rowid'];
					this.slide_rowid = command['slide_rowid'];
					this.pres_no = command['pres_no'];
					this.slide_no = command['slide_no'];
					this.schedulerev = command['schedulerev'];
					this.liverev = command['liverev'];
					this.imagehash = command['imagehash'];
					this.permissions = command['permissions'];
				}

				const sendBuf = Buffer.from(`{"action":"heartbeat","requestrev":"${this.requestrev}"}\r\n`, 'latin1');
				
				if (sendBuf != '') {
					if (this.socket && this.socket.isConnected) {
						this.socket.send(sendBuf);
					}
				}
			}
		} catch (err) {
			this.log('error', 'handleSocketData Exception: ', err, ' on JSON ', data.toString());
		}

		this.checkFeedbacks();
	}
}
runEntrypoint(EasyWorshipInstance, [])