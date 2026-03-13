/**
 * Builds the full status payload that EasyWorship expects when toggling
 * display overlays (logo, black, clear). EW requires the complete current
 * state — not just the changed field — because it replaces its state
 * wholesale from this payload.
 */
function buildStatusPayload(instance) {
	return {
		action: 'status',
		logo: instance.EZWLogo === 1,
		black: instance.EZWBlack === 1,
		clear: instance.EZWClear === 1,
		rectype: instance.rectype,
		pres_rowid: instance.pres_rowid,
		slide_rowid: instance.slide_rowid,
		pres_no: instance.pres_no,
		slide_no: instance.slide_no,
		schedulerev: instance.schedulerev,
		liverev: instance.liverev,
		imagehash: instance.imagehash,
		permissions: instance.permissions,
		requestrev: instance.requestrev,
	}
}

/**
 * Gate for all outgoing commands. Returns true if the command was sent,
 * false if it was dropped. Callers that do optimistic state updates
 * should revert when this returns false.
 *
 * When unpaired but TCP-connected, re-sends the pair request so the
 * user doesn't have to manually reconnect. When fully disconnected,
 * schedules a reconnection attempt.
 */
const sendCommand = function (cmd) {
	if (!this.paired) {
		this.log('warn', 'Not paired with EasyWorship. Command not sent.')

		if (this.connected) {
			// TCP is up but not paired — re-send the pair request so the
			// next button press has a chance of working without manual intervention
			this.log('info', 'Connected but not paired. Re-sending pair request...')
			const sanitizedName = (this.config.ClientName || '').replace(/[\x00-\x1f]/g, '').slice(0, 64)
			this.socketSend(JSON.stringify({
				action: 'connect',
				uid: this.config.UUID,
				device_name: sanitizedName,
				device_type: 8,
				requestrev: '0',
			}))
		} else {
			this.scheduleReconnect()
		}
		return false
	}

	if (!cmd) return false

	this.socketSend(cmd)
	return true
}

module.exports = {
	sendCommand,
	actions() {
		return {
			// --- Display overlay toggles ---
			// Logo, Black, and Clear are display overlays in EasyWorship.
			// Logo and Black are mutually exclusive (enabling one disables the other).
			// Clear operates independently — it can be on alongside Logo or Black.
			// All three use optimistic state updates for responsive button feedback,
			// reverting if the command fails to send.

			logo: {
				name: 'Toggle Logo',
				options: [],
				callback: () => {
					const prevLogo = this.EZWLogo
					const prevBlack = this.EZWBlack

					// Logo and Black are mutually exclusive in EW
					if (this.EZWLogo === 0) {
						this.EZWLogo = 1
						this.EZWBlack = 0
					} else {
						this.EZWLogo = 0
					}

					if (!this.sendCommand(JSON.stringify(buildStatusPayload(this)))) {
						// Command didn't send — revert so buttons don't lie
						this.EZWLogo = prevLogo
						this.EZWBlack = prevBlack
					}
					this.checkFeedbacks()
				},
			},
			black: {
				name: 'Toggle Black',
				options: [],
				callback: () => {
					const prevBlack = this.EZWBlack
					const prevLogo = this.EZWLogo

					// Black and Logo are mutually exclusive in EW
					if (this.EZWBlack === 0) {
						this.EZWBlack = 1
						this.EZWLogo = 0
					} else {
						this.EZWBlack = 0
					}

					if (!this.sendCommand(JSON.stringify(buildStatusPayload(this)))) {
						this.EZWBlack = prevBlack
						this.EZWLogo = prevLogo
					}
					this.checkFeedbacks()
				},
			},
			clear: {
				name: 'Toggle Clear',
				options: [],
				callback: () => {
					const prevClear = this.EZWClear

					this.EZWClear = this.EZWClear === 0 ? 1 : 0

					if (!this.sendCommand(JSON.stringify(buildStatusPayload(this)))) {
						this.EZWClear = prevClear
					}
					this.checkFeedbacks()
				},
			},

			// --- Slide navigation ---
			// These operate within the currently active schedule item.

			prevslide: {
				name: 'Previous Slide',
				options: [],
				callback: () => {
					this.sendCommand(JSON.stringify({ action: 'prevSlide', requestrev: this.requestrev }))
				},
			},
			nextslide: {
				name: 'Next Slide',
				options: [],
				callback: () => {
					this.sendCommand(JSON.stringify({ action: 'nextSlide', requestrev: this.requestrev }))
				},
			},

			// --- Media playback ---
			// Controls media playback within the current schedule item.
			// Note: EW does not report play/pause state back to us, so there
			// is no feedback for these — the tech must watch the EW output.

			play: {
				name: 'Play',
				options: [],
				callback: () => {
					this.sendCommand(JSON.stringify({ action: 'Play', requestrev: this.requestrev }))
				},
			},
			pause: {
				name: 'Pause',
				options: [],
				callback: () => {
					this.sendCommand(JSON.stringify({ action: 'Pause', requestrev: this.requestrev }))
				},
			},
			toggle: {
				name: 'Toggle Play/Pause',
				options: [],
				callback: () => {
					this.sendCommand(JSON.stringify({ action: 'Toggle', requestrev: this.requestrev }))
				},
			},

			// --- Schedule navigation ---
			// Moves between items in the EW schedule (songs, scriptures, media, etc).
			// The presets auto-chain Presentation Start after these so the new
			// schedule item starts from slide 1.

			prevsched: {
				name: 'Previous Schedule',
				options: [],
				callback: () => {
					this.sendCommand(JSON.stringify({ action: 'prevSchedule', requestrev: this.requestrev }))
				},
			},
			nextsched: {
				name: 'Next Schedule',
				options: [],
				callback: () => {
					this.sendCommand(JSON.stringify({ action: 'nextSchedule', requestrev: this.requestrev }))
				},
			},

			// --- Build navigation ---
			// Navigates through slide builds (animation steps within a single slide).

			prevbuild: {
				name: 'Previous Build',
				options: [],
				callback: () => {
					this.sendCommand(JSON.stringify({ action: 'prevBuild', requestrev: this.requestrev }))
				},
			},
			nextbuild: {
				name: 'Next Build',
				options: [],
				callback: () => {
					this.sendCommand(JSON.stringify({ action: 'nextBuild', requestrev: this.requestrev }))
				},
			},

			// --- Position jumps ---

			presstart: {
				name: 'Presentation Start',
				options: [],
				callback: () => {
					this.sendCommand(JSON.stringify({ action: 'gotoStartPresentation', requestrev: this.requestrev }))
				},
			},
			slidestart: {
				name: 'Slide Start',
				options: [],
				callback: () => {
					this.sendCommand(JSON.stringify({ action: 'gotoStartSlide', requestrev: this.requestrev }))
				},
			},

			// --- Connection management ---
			// Full reset: tears down TCP, stops mDNS, and restarts discovery from scratch.
			// Resets the retry counter so the user gets immediate aggressive retries.

			connectezw: {
				name: 'Reconnect to EasyWorship',
				options: [],
				callback: () => {
					// Nuclear reset: tear everything down and start fresh.
					// This is the ONE place we force-restart Bonjour — the user
					// explicitly asked for a reconnect.
					this.retryAttempts = 0
					this.clearRetry()
					this.clearIdleTimer()
					this.destroySocket()
					this.stopDiscovery()
					this.startDiscovery()
				},
			},

			// --- Parameterized jumps ---
			// Go to a specific slide or schedule item by number.
			// The number is concatenated into the action string because
			// that's the format EW's remote protocol expects.

			gotoslide: {
				name: 'Go to Slide',
				options: [{
					type: 'number',
					min: 1,
					id: 'id_gotoslide',
					label: 'Slide number:',
					tooltip: 'Enter the slide number to go to.',
					default: 1,
					required: true,
				}],
				callback: (action) => {
					const slideNum = Number(action.options.id_gotoslide)
					if (!Number.isInteger(slideNum) || slideNum < 1) {
						this.log('error', `Invalid slide number: ${action.options.id_gotoslide}`)
						return
					}
					this.sendCommand(JSON.stringify({
						action: 'gotoSlide ' + slideNum,
						requestrev: this.requestrev,
					}))
				},
			},
			gotoschedule: {
				name: 'Go to Schedule',
				options: [{
					type: 'number',
					min: 1,
					id: 'id_gotoschedule',
					label: 'Schedule number:',
					tooltip: 'Enter the schedule number to go to.',
					default: 1,
					required: true,
				}],
				callback: (action) => {
					const schedNum = Number(action.options.id_gotoschedule)
					if (!Number.isInteger(schedNum) || schedNum < 1) {
						this.log('error', `Invalid schedule number: ${action.options.id_gotoschedule}`)
						return
					}
					this.sendCommand(JSON.stringify({
						action: 'gotoSchedule ' + schedNum,
						requestrev: this.requestrev,
					}))
				},
			},
		}
	},
}
