var https = require('https');

module.exports = function (app) {
	const logError =
		app.error ||
		(err => {
			console.error(err)
		})
	const debug =
		app.debug ||
		(msg => {
			console.log(msg)
		})

	var plugin = {
		unsubscribes: []
	}

	plugin.id = 'quartermaster-signalk-plugin';
	plugin.name = 'Quartermaster Tracker (Beta)';
	plugin.description = 'Track your yacht in Quartermaster';

	plugin.schema = () => ({
		title: 'Set System Time with sudo',
		type: 'object',
		properties: {
			interval: {
				type: 'number',
				title: 'Interval between GPS updates in seconds (120 seconds is default)',
				default: 120
			},
			key: {
				type: 'string',
				title: 'Yacht tracking key. Get it from https://quartermaster.me',
				default: ''
			}
		}
	})

	plugin.start = function (options) {
		try {
			debug('Starting Quartermaster plugin')
			if (options.interval < 120) {
				options.interval = 120;
			}
			debug('Interval: ' + options.interval);
			let stream = app.streambundle.getSelfStream('navigation.position')
			stream = stream.debounceImmediate(options.interval * 1000)
			// stream = stream.take(1)
			plugin.unsubscribes.push(
				stream.onValue(function (pos) {
					debug(pos);
					try {
						plugin.postCheckin(options.key, pos.latitude, pos.longitude);
					} catch (e) {
						logError(e);
					}
				})
			)
		} catch (e) {
			logError(e);
		}
	}

	plugin.postData = function (url = "", data = {}) {
		try {
			var post_data = JSON.stringify(data);

			// An object of options to indicate where to post to
			var post_options = {
				host: 'quartermaster.me',
				// port: 80,
				path: url,
				method: 'POST',
				headers: {
					// 'Content-Type': 'application/x-www-form-urlencoded',
					"Content-Type": "application/json",
					'Content-Length': Buffer.byteLength(post_data)
				}
			};

			// Set up the request
			var post_req = https.request(post_options, function (res) {
				res.setEncoding('utf8');
				res.on('data', function (chunk) {
					if (chunk.startsWith('{"Id":')) {
						debug('Successfully posted to Quartermaster: ' + post_data + " : " + chunk);
					} else {
						logError('Failed to post to Quartermaster: ' + post_data + " : " + chunk);
					}
				});
			});

			// post the data
			post_req.write(post_data);
			post_req.end();
		}
		catch (e) {
			logError(e);
		}
	}

	plugin.postCheckin = (key, lat, lon) => {
		plugin.postData("/public/tracks/checkin", { Key: key, Latitude: lat, Longitude: lon, Source:'quartermaster-signalk-plugin', RawInput: '' });
	}

	plugin.stop = function () {
		debug('Stopping Quartermaster plugin')
		plugin.unsubscribes.forEach(f => f())
	}

	return plugin

};