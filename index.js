var tcp           = require('../../tcp');
var bonjour       = require('./bonjour')({multicast: true});
var instance_skel = require('../../instance_skel');
const { selectColor } = require('debug');
var debug;
var log;

instance.prototype.config_fields	= require('./config');
instance.prototype.actions			= require('./actions');
instance.prototype.action			= require('./action');
instance.prototype.init_feedback	= require('./init_feedback');
instance.prototype.feedback			= require('./feedback'); // does nothing, feedbacks are in callbacks
instance.prototype.init_presets		= require('./presets');
instance.prototype.init_variables	= require('./variables');

function uuidv4() {
	return 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'.replace(/[x]/g, function(c) {
		var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
		return v.toString(16);
	});
}  

function instance(system, id, config) {
	var self = this;

	// super-constructor
	instance_skel.apply(this, arguments);
	self.actions(); // export actions

	return self;
}

instance.prototype.init = function() {
	var self = this;

	debug = self.debug;
	log = self.log;

	if (self.config.EWServer === undefined)
		self.config.EWServer = '';
	if (self.config.UUID === undefined) {
		self.config.UUID = uuidv4();
		self.saveConfig();
	}
	console.debug('ID=' + self.id);
	console.debug('UUID=' + self.config.UUID);
	console.debug('Last EasyWorship Server=', self.config.EWServer);

	self.connected = false;
	self.ezw = [];

	self.init_feedback();
	self.init_variables();
	self.init_presets();
	self.init_bonjour();
}

instance.prototype.updateConfig = function(config) {
	var self = this;

	self.config = config;

	// Save the selected server so the next instance of companion will be able to make the correct initial connection
	console.debug('Selected EasyWorship Server: ',self.config.EWServers);
	self.config.EWServer = self.config.EWServers;
	self.saveConfig();

	// Tear down and initialize with updated configuration
	self.destroy();
	self.init();
}

instance.prototype.init_bonjour = function() {
	var self = this;

	self.ezw = [];
	self.status(self.STATE_WARNING, 'Searching for EasyWorship Servers');
	self.log('info','Searching for EasyWorship Servers');
	console.debug('Bonjour Searching for EasyWorship Servers');
	bonjour.find({name: '_ezwremote._tcp'}, function (service) {
		var type = service['type'];
		if (type != undefined && type === 'ezwremote') {
		var name = service['name'];
			var bExists = false;
			for (const servername of self.ezw) {
				if (servername == name) {
					bExists = true;
				}
			}
			if (!bExists) {
				console.debug('Found Server: ', service);
				self.ezw.push(name);
				if (name == self.config.EWServer) {
					self.config.EWPort = service['port'];
					self.config.EWAddr = service['referer']['address'];
					console.debug('Default EasyWorship Server=', self.config.EWServer, 'at IP', self.config.EWAddr, 'on Port', self.config.EWPort);
				}
			}
		}
	});
}

instance.prototype.init_tcp = function() {
	var self = this;

	if (self.socket !== undefined) {
		self.socket.destroy();
		delete self.socket;
	}

	self.status(self.STATE_WARNING, 'Connecting');

	if (self.config.EWAddr && self.config.EWPort)  {
			self.socket = new tcp(self.config.EWAddr, self.config.EWPort);

		self.socket.on('status_change', function (status, message) {
			self.status(status, message);
		});

		self.socket.on('error', function (err) {
			console.debug('Network error', err.message);
			self.status(self.STATE_ERROR, err);
			self.log('error','Network error: ' + err.message);

			// Tear down and reinitialize. The server port is going to change.  Otherwise have to edit configuration and save to get new port
			self.destroy();
			self.init();
		});

		self.socket.on('connect', function () {
			if (self.connected) {
				return;
			}

			if (self.config.ClientName === undefined) {
				self.log('error','No name in configuration.  Can\'t connect to ' + self.config.EWServer);
				return;
			}
			self.status(self.STATE_OK);
			self.log('info','Connected to ' + self.config.EWServer);
			console.debug('Connected to ' + self.config.EWServer);
			self.connected = true;
			var cmd = '{"action":"connect", "uid":"' + self.config.UUID + '", "device_name":"' + self.config.ClientName + '", "device_type":8, "requestrev":"0"}';
			var sendBuf = Buffer.from(cmd + '\r\n', 'latin1');
			if (sendBuf != '') {
				if (self.socket !== undefined && self.socket.connected) {
					self.socket.send(sendBuf);
					console.debug('sent ', cmd);
				}
			}
		})

		self.socket.on('close', function () {
			self.status(self.STATE_ERROR);
			self.log('info', 'Lost connection to ' + self.config.EWServer);
			console.debug('Lost connection to ' + self.config.EWServer);
			self.connected = false;
		})

		self.socket.on('data', function (data) {
			try {
				var json = data.toString();
				var cmds = json.split('\r\n');
				for (var i = 0; i < cmds.length - 1; i++) {
					var cmd = cmds[i].toString();
					cmd = cmd.split('\r\n')[0];
					console.debug(cmd);
					var command = JSON.parse(cmd);
					self.requestrev = command['requestrev'];
					var action = command['action'];
					if (action == 'notPaired') {
						self.status(self.STATE_WARNING);
						self.log('info', 'Not paired with ' + self.config.EWServer);
						console.debug('Not paired with ' + self.config.EWServer);
						self.config.paired = false;
					}
					else if (action == 'paired') {
						self.status(self.STATE_OK);
						self.log('info', 'Paired with ' + self.config.EWServer);
						console.debug('Paired with ' + self.config.EWServer);
						self.config.paired = true;
					}
					else if (action == 'status') {
						self.status(self.STATE_OK);
						console.debug('Received status of ' + self.config.EWServer);
						self.EZWLogo = command['logo'] ? 1 : 0;
						self.EZWBlack = command['black'] ? 1 : 0;
						self.EZWClear = command['clear'] ? 1 : 0;
						self.EZWLivePreview = 0;
						self.setVariable('Logo', self.EZWLogo);
						self.setVariable('Black', self.EZWBlack);
						self.setVariable('Clear', self.EZWClear);
						self.setVariable('LivePreview', self.EZWLivePreview);

						// Pickup values to send for logo/black/clear actions
						self.rectype = command['rectype'];
						self.pres_rowid = command['pres_rowid'];
						self.slide_rowid = command['slide_rowid'];
						self.pres_no = command['pres_no'];
						self.slide_no = command['slide_no'];
						self.schedulerev = command['schedulerev'];
						self.liverev = command['liverev'];
						self.imagehash = command['imagehash'];
						self.permissions = command['permissions'];

						console.debug('{"action":"status","logo":"' + (self.EZWLogo ? 'true' : 'false') + '","black":"' + (self.EZWBlack ? 'true' : 'false') + '","clear":"' + (self.EZWClear ? 'true' : 'false') + '","rectype":' + self.rectype + ',"pres_rowid":"' + self.pres_rowid + '","slide_rowid":"' + self.slide_rowid + '","pres_no":"' + self.pres_no + '","slide_no":"' + self.slide_no + '","schedulerev":"' + self.schedulerev + '","liverev":"' + self.liverev + '","imagehash":"' + self.imagehash + '","permissions":' + self.permissions + ',"requestrev":"' + self.requestrev + '"}');
					}
					var sendBuf = Buffer.from('{"action":"heartbeat","requestrev":"' + self.requestrev + '"}\r\n', 'latin1');
					if (sendBuf != '') {
						if (self.socket !== undefined && self.socket.connected) {
							self.socket.send(sendBuf);
							console.debug('sent ' + sendBuf.toString());
						}
					}
									}
			} catch (err) {
				console.debug('Exception: ', err, ' on JSON ', data.toString());
			}

			self.checkFeedbacks();
		});
	}
}

instance.prototype.destroy = function() {
	var self = this;

	if (self.socket !== undefined) {
		self.socket.destroy();
	}

	console.debug("module destroyed: ", self.id);
}

instance_skel.extendedBy(instance);
exports = module.exports = instance;