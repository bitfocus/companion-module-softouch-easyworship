const sendCommand = function (cmd) {
    //this.log('debug', 'sendCommand - Sending command: ' + JSON.stringify(cmd));

    if (!this.paired) {
        //this.log('warn', 'Not paired with EasyWorship. Command not sent: ' + cmd);
        this.log('warn', 'Not paired with EasyWorship');

        if (this.connected) {
            this.log('info', 'this.connected is true, but not paired. Destroying connection and reinitializing...');
            this.destroy();
            this.init(this.config);
        } else {
            if (!this.config.EWAddr || !this.config.EWPort) {
                this.log('warn', 'EasyWorship server address or port is missing. Rediscovering servers...');
                this.initBonjour(() => {
                    this.initTCP();
                });
            } else {
                this.log('info', 'Attempting to connect to EasyWorship...');
                this.initTCP();
            }
        }
        
        return;
    }

    if (cmd === undefined || cmd === null || cmd === ''){
        return
    }

    const sendBuf = Buffer.from(cmd + '\r\n', 'latin1');
    if (this.socket) {
        if (this.socket.isConnected !== undefined && this.socket.isConnected) {
            this.socket.send(sendBuf)
                .then((i) => {
                })
                .catch((err) => {
                });
        } else {
            this.log('error', `Socket not connected or state unknown (connected: ${this.socket.isConnected}).`);
        }
    } else {
        this.log('error', 'sendCommand - Socket is undefined.');
    }
};

module.exports = {
	sendCommand,
    actions() {
        const defaultChoice = { id: '0', label: 'Not used' };

        // Define the actions
        let actions = {
            logo: {
                name: 'Logo Command',
                options: [
                {
                    type: 'dropdown',
                    id: 'id_logo',
                    label: 'Command:',
                    tooltip: 'Toggle the Logo screen',
                    default: 0,
                    choices: [defaultChoice],
                },
                ],
                callback: (action) => {
                    if (this.EZWLogo === 0) {
                        this.EZWLogo = 1
                        this.EZWBlack = 0
                    } else {
                        this.EZWLogo = 0
                    }

                    const cmd = JSON.stringify({
                        action: 'status',
                        logo: this.EZWLogo === 1,
                        black: this.EZWBlack === 1,
                        clear: this.EZWClear === 1,
                        rectype: this.rectype,
                        pres_rowid: this.pres_rowid,
                        slide_rowid: this.slide_rowid,
                        pres_no: this.pres_no,
                        slide_no: this.slide_no,
                        schedulerev: this.schedulerev,
                        liverev: this.liverev,
                        imagehash: this.imagehash,
                        permissions: this.permissions,
                        requestrev: this.requestrev,
                    })

                    this.sendCommand(cmd)
                    this.checkFeedbacks() 
                },
            },
            black: {
                name: 'Toggle Black',
                options: [
                {
                    type: 'dropdown',
                    id: 'id_black',
                    label: 'Command:',
                    tooltip: 'Toggle the Black screen',
                    default: 0,
                    choices: [defaultChoice],
                },
                ],
                callback: (action) => {
                    if (this.EZWBlack === 0) {
                        this.EZWBlack = 1
                        this.EZWLogo = 0
                    } else {
                        this.EZWBlack = 0
                    }

                    const cmd = JSON.stringify({
                        action: 'status',
                        logo: this.EZWLogo === 1,
                        black: this.EZWBlack === 1,
                        clear: this.EZWClear === 1,
                        rectype: this.rectype,
                        pres_rowid: this.pres_rowid,
                        slide_rowid: this.slide_rowid,
                        pres_no: this.pres_no,
                        slide_no: this.slide_no,
                        schedulerev: this.schedulerev,
                        liverev: this.liverev,
                        imagehash: this.imagehash,
                        permissions: this.permissions,
                        requestrev: this.requestrev,
                    })

                    this.sendCommand(cmd)
                    this.checkFeedbacks() 
                },
            },
            clear: {
                name: 'Toggle Clear',
                options: [
                {
                    type: 'dropdown',
                    id: 'id_clear',
                    label: 'Command:',
                    tooltip: 'Toggle the Clear screen',
                    default: 0,
                    choices: [defaultChoice],
                },
                ],
                callback: (action) => {
                    this.EZWClear = this.EZWClear === 0 ? 1 : 0

                    const cmd = JSON.stringify({
                        action: 'status',
                        logo: this.EZWLogo === 1,
                        black: this.EZWBlack === 1,
                        clear: this.EZWClear === 1,
                        rectype: this.rectype,
                        pres_rowid: this.pres_rowid,
                        slide_rowid: this.slide_rowid,
                        pres_no: this.pres_no,
                        slide_no: this.slide_no,
                        schedulerev: this.schedulerev,
                        liverev: this.liverev,
                        imagehash: this.imagehash,
                        permissions: this.permissions,
                        requestrev: this.requestrev,
                    })

                    this.sendCommand(cmd)
                    this.checkFeedbacks() 
                },
            },
            prevslide: {
                name: 'Previous Slide',
                options: [
                {
                    type: 'dropdown',
                    id: 'id_prevslide',
                    label: 'Command:',
                    tooltip: 'Goto the previous slide',
                    default: 0,
                    choices: [defaultChoice],
                },
                ],
                callback: (action) => {
                    const cmd = JSON.stringify({
                        action: 'prevSlide',
                        requestrev: this.requestrev,
                    })

                    this.sendCommand(cmd)
                },
            },
            nextslide: {
                name: 'Next Slide',
                options: [
                {
                    type: 'dropdown',
                    id: 'id_nextslide',
                    label: 'Command:',
                    tooltip: 'Goto the next slide',
                    default: 0,
                    choices: [defaultChoice],
                },
                ],
                callback: (action) => {
                    const cmd = JSON.stringify({
                        action: 'nextSlide',
                        requestrev: this.requestrev,
                    })

                    this.sendCommand(cmd)
                },
            },
            play: {
                name: 'Play Command',
                options: [
                {
                    type: 'dropdown',
                    id: 'id_play',
                    label: 'Command:',
                    tooltip: 'Play the media',
                    default: 0,
                    choices: [defaultChoice],
                },
                ],
                callback: (action) => {
                    const cmd = JSON.stringify({
                        action: 'Play',
                        requestrev: this.requestrev,
                    })

                    this.sendCommand(cmd)
                },
            },
            pause: {
                name: 'Pause Command',
                options: [
                {
                    type: 'dropdown',
                    id: 'id_pause',
                    label: 'Command:',
                    tooltip: 'Pause the media',
                    default: 0,
                    choices: [defaultChoice],
                },
                ],
                callback: (action) => {
                    const cmd = JSON.stringify({
                        action: 'Pause',
                        requestrev: this.requestrev,
                    })

                    this.sendCommand(cmd)
                },
            },
            toggle: {
                name: 'Toggle Command',
                options: [
                {
                    type: 'dropdown',
                    id: 'id_toggle',
                    label: 'Command:',
                    tooltip: 'Toggle Play/Pause for the media',
                    default: 0,
                    choices: [defaultChoice],
                },
                ],
                callback: (action) => {
                    const cmd = JSON.stringify({
                        action: 'Toggle',
                        requestrev: this.requestrev,
                    })

                    this.sendCommand(cmd)
                },
            },
            prevsched: {
                name: 'Schedule Previous Command',
                options: [
                {
                    type: 'dropdown',
                    id: 'id_prevsched',
                    label: 'Command:',
                    tooltip: 'Goto the previous schedule',
                    default: 0,
                    choices: [defaultChoice],
                },
                ],
                callback: async () => {
                    const cmd = JSON.stringify({
                        action: 'prevSchedule',
                        requestrev: this.requestrev,
                    })

                    this.sendCommand(cmd)
                },
            },
            nextsched: {
                name: 'Schedule Next Command',
                options: [
                {
                    type: 'dropdown',
                    id: 'id_nextsched',
                    label: 'Command:',
                    tooltip: 'Goto the next schedule',
                    default: 0,
                    choices: [defaultChoice],
                },
                ],
                callback: async () => {
                    const cmd = JSON.stringify({
                        action: 'nextSchedule',
                        requestrev: this.requestrev,
                    })

                    this.sendCommand(cmd)
                },
            },
            prevbuild: {
                name: 'Build Previous Command',
                options: [
                {
                    type: 'dropdown',
                    id: 'id_prevbuild',
                    label: 'Command:',
                    tooltip: 'Goto the previous build',
                    default: 0,
                    choices: [defaultChoice],
                },
                ],
                callback: (action) => {
                const cmd = JSON.stringify({
                    action: 'prevBuild',
                    requestrev: this.requestrev,
                })

                this.sendCommand(cmd)
                },
            },
            nextbuild: {
                name: 'Build Next Command',
                options: [
                {
                    type: 'dropdown',
                    id: 'id_nextbuild',
                    label: 'Command:',
                    tooltip: 'Goto the next build',
                    default: 0,
                    choices: [defaultChoice],
                },
                ],
                callback: (action) => {
                    const cmd = JSON.stringify({
                        action: 'nextBuild',
                        requestrev: this.requestrev,
                    })

                    this.sendCommand(cmd)
                },
            },
            presstart: {
                name: 'Presentation Start Command',
                options: [
                {
                    type: 'dropdown',
                    id: 'id_presstart',
                    label: 'Command:',
                    tooltip: 'Goto the presentation start',
                    default: 0,
                    choices: [defaultChoice],
                },
                ],
                callback: (action) => {
                    const cmd = JSON.stringify({
                        action: 'gotoStartPresentation',
                        requestrev: this.requestrev,
                    })

                    this.sendCommand(cmd)
                },
            },
            slidestart: {
                name: 'Slide Start Command',
                options: [{
                    type: 'dropdown',
                    id: 'id_slidestart',
                    label: 'Command:',
                    tooltip: 'Goto the slide start',
                    default: 0,
                    choices: [defaultChoice],
                }],
                callback: (action) => {
                    const cmd = JSON.stringify({
                        action: 'gotoStartSlide',
                        requestrev: this.requestrev,
                    })

                    this.sendCommand(cmd)
                },
            },
            connectezw: {
                name: 'Connect to EasyWorship',
                options: [{
                    type: 'dropdown',
                    id: 'id_connectezw',
                    label: 'Command:',
                    tooltip: 'Connect to EasyWorship',
                    default: 0,
                    choices: [defaultChoice],
                }],
                callback: async () => {
                    if (this.connected) {
                        this.destroy()
                        this.init(this.config)
                    } 
                    else {
                        if (!this.config.EWAddr || !this.config.EWPort) {
                            this.log('warn', 'EasyWorship server address or port is missing. Rediscovering servers...')
                            this.initBonjour(() => {
                                this.initTCP();
                            });
                        } else {
                            this.log('info', 'Attempting to connect to EasyWorship...')
                            this.initTCP()
                        }
                    }
                },
            },
            gotoslide: {
                name: 'Goto Slide',
                options: [
                {
                    type: 'number',
                    min: 1,
                    id: 'id_gotoslide',
                    label: 'Go to slide:',
                    tooltip: 'Enter the number of the slide to go to.',
                    default: 1,
                    required: true,
                },
                ],
                callback: (action) => {
                    const slideNum = Number(action.options.id_gotoslide);
                    if (!Number.isInteger(slideNum) || slideNum < 1) {
                        this.log('error', `Invalid slide number: ${action.options.id_gotoslide}`);
                        return;
                    }
                    this.log('info', ` slide number: ${slideNum}`);
                    const cmd = JSON.stringify({
                        action: 'gotoSlide ' + slideNum,
                        requestrev: this.requestrev,
                    });
                    this.sendCommand(cmd)
                },
            },
            gotoschedule: {
                name: 'Goto Schedule',
                options: [
                {
                    type: 'number',
                    min: 1,
                    id: 'id_gotoschedule',
                    label: 'Go to schedule:',
                    tooltip: 'Enter the schedule number to go to.',
                    default: 1,
                    required: true,
                },
                ],
                callback: (action) => {
                    const schedNum = Number(action.options.id_gotoschedule);
                    if (!Number.isInteger(schedNum) || schedNum < 1) {
                        this.log('error', `Invalid slide number: ${action.options.id_gotoschedule}`);
                        return;
                    }

                    this.log('info', ` Schedule number: ${schedNum}`);
                    const cmd = JSON.stringify({
                        action: 'gotoSchedule ' + schedNum,
                        requestrev: this.requestrev,
                    })
                    this.sendCommand(cmd)
                },
            },
            // live: {
            //     name: 'Live Preview',
            //     options: [],
            //     callback: () => {
            //         // Toggle the Live Preview state
            //         this.EZWLivePreview = this.EZWLivePreview === 0 ? 1 : 0;

            //         const cmd = JSON.stringify({
            //             action: 'live',
            //             requestrev: this.requestrev,
            //         })
            //         this.sendCommand(cmd)

            //         // Trigger feedbacks
            //         this.checkFeedbacks('is_livepreview');
            //     },
            // },
        };

        // Return the actions object
        return actions;
    },
};