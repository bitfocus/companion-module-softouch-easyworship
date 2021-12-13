exports = module.exports = function (inboundAction) {
	var self = this;
	var action = inboundAction.action;
	var cmd;

	switch(action) {
		case 'logo':
		case 'black':
		case 'clear':
			if (action == 'logo') {
				if (self.EZWLogo == 0) {
					self.EZWLogo = 1;
					self.EZWBlack = 0;
				}
				else {
					self.EZWLogo = 0;
				}
			}
			else if (action == 'black') {
				if (self.EZWBlack == 0) {
					self.EZWBlack = 1;
					self.EZWLogo = 0;
				}
				else {
					self.EZWBlack = 0;
				}
			}
			else {
				if (self.EZWClear == 0) {
					self.EZWClear = 1;
				}
				else {
					self.EZWClear = 0;
				}
			}

			cmd = '{"action":"status","logo":' + (self.EZWLogo ? 'true' : 'false') + ',"black":' + (self.EZWBlack ? 'true' : 'false') + ',"clear":' + (self.EZWClear ? 'true' : 'false') + ',"rectype":' + self.rectype + ',"pres_rowid":"' + self.pres_rowid + '","slide_rowid":"' + self.slide_rowid + '","pres_no":"' + self.pres_no + '","slide_no":"' + self.slide_no + '","schedulerev":"' + self.schedulerev + '","liverev":"' + self.liverev + '","imagehash":"' + self.imagehash + '","permissions":' + self.permissions + ',"requestrev":"' + self.requestrev + '"}';
			self.log('info', cmd);
			break;

		case 'prevslide':
			cmd = '{"action":"prevSlide","requestrev":"' + self.requestrev + '"}';
			break;

		case 'nextslide':
			cmd = '{"action":"nextSlide","requestrev":"' + self.requestrev + '"}';
			break;

		case 'play':
			cmd = '{"action":"Play","requestrev":"' + self.requestrev + '"}';
			break;

		case 'pause':
			cmd = '{"action":"Pause","requestrev":"' + self.requestrev + '"}';
			break;

		case 'toggle':
			cmd = '{"action":"Toggle","requestrev":"' + self.requestrev + '"}';
			break;

		case 'prevsched':
			cmd = '{"action":"prevSchedule","requestrev":"' + self.requestrev + '"}';
			break;

		case 'nextsched':
			cmd = '{"action":"nextSchedule","requestrev":"' + self.requestrev + '"}';
			break;

		case 'prevbuild':
			cmd = '{"action":"prevBuild","requestrev":"' + self.requestrev + '"}';
			break;

		case 'nextbuild':
			cmd = '{"action":"nextBuild","requestrev":"' + self.requestrev + '"}';
			break;

		case 'presstart':
			cmd = '{"action":"gotoStartPresentation","requestrev":"' + self.requestrev + '"}';
			break;

		case 'slidestart':
			cmd = '{"action":"gotoStartSlide","requestrev":"' + self.requestrev + '"}';
			break;

		case 'connectezw':
			if (self.connected) {
				self.destroy();
				self.init();
			}
			else {
				self.init_tcp();
			}
			return;

		case 'gotoslide':
			cmd = '{"action":"gotoSlide ' + inboundAction.options.id_gotoslide + '","requestrev":"' + self.requestrev + '"}';
			break;

		case 'gotoschedule':
			cmd = '{"action":"gotoSchedule ' + inboundAction.options.id_gotoschedule + '","requestrev":"' + self.requestrev + '"}';
			break;

		default:
			cmd = '';
	}

	if (cmd != '') {
		// 
		// create a binary buffer pre-encoded 'latin1' (8bit no change bytes)
		// sending a string assumes 'utf8' encoding 
		// which then escapes character values over 0x7F
		// and destroys the 'binary' content
		//
		var sendBuf = Buffer.from(cmd + '\r\n', 'latin1');
		if (sendBuf != '') {
			if (self.socket !== undefined && self.socket.connected) {
				self.socket.send(sendBuf);
			}
		}
	}
};