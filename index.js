'use strict';
const Promise = require('bluebird');
const streamToPromise = require('stream-to-promise');
const rp = require('request-promise');

const url = 'https://graph-video.facebook.com';

function apiInit(args, videoSize) {
	const options = {
		method: 'POST',
		uri: `${url}/v2.6/${args.id}/videos?access_token=${args.token}`,
		json: true,
		form: {
			upload_phase: 'start',
			file_size: videoSize
		}
	};

	return rp(options);
}

function apiFinish(args, id, video_id) {
	const videoTitle = args.title || ''
	const description = args.description || ''
	let formData = {
		access_token: args.token,
		upload_phase: 'finish',
		upload_session_id: id,
		title: videoTitle,
		description: description
	}
	
	if(args.secret)
		formData.secret = true
	
	const options = {
		method: 'POST',
		uri: `${url}/v2.6/${args.id}/videos`,
		form: formData,
		json: true
	};

	return rp(options)
		.then(res => {
			res.video_id = video_id;
			return res;
		});
}

function uploadChunk(args, id, start, chunk) {
	const formData = {
		access_token: args.token,
		upload_phase: 'transfer',
		start_offset: start,
		upload_session_id: id,
		video_file_chunk: {
			value: chunk,
			options: {
				filename: 'chunk'
			}
		}
	};
	const options = {
		method: 'POST',
		uri: `${url}/v2.6/${args.id}/videos`,
		formData: formData,
		json: true
	};

	return rp(options);
}

function uploadChain(buffer, args, res, ids) {
	if (res.start_offset === res.end_offset) {
		return ids;
	}
	var chunk = buffer.slice(res.start_offset, res.end_offset);
	return uploadChunk(args, ids[0], res.start_offset, chunk)
	.then(res => uploadChain(buffer, args, res, ids));
}

function facebookApiVideoUpload(args) {
	return Promise.resolve(streamToPromise(args.stream))
		.then(buffer => buffer)
		.then(buffer => [buffer, apiInit(args, buffer.length)])
		.spread((buffer, res) => {
			const ids = [res.upload_session_id, res.video_id];
			return uploadChain(buffer, args, res, ids);
		})
		.spread((id, video_id) => apiFinish(args, id, video_id));
}

module.exports = facebookApiVideoUpload;
