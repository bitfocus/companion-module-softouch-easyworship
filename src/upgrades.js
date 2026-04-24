module.exports = [
	// v2.0.2 → v2.1.0: Remove dummy "Not used" dropdown options that were present
	// on 15 actions (logo, black, clear, prevslide, nextslide, play, pause, toggle,
	// prevsched, nextsched, prevbuild, nextbuild, presstart, slidestart, connectezw).
	// These options were never read by any callback so deleting them is safe.
	function v210_removeDummyOptions(_context, props) {
		const dummyOptionIds = [
			'id_logo', 'id_black', 'id_clear',
			'id_prevslide', 'id_nextslide',
			'id_play', 'id_pause', 'id_toggle',
			'id_prevsched', 'id_nextsched',
			'id_prevbuild', 'id_nextbuild',
			'id_presstart', 'id_slidestart',
			'id_connectezw',
		]
		const updatedActions = []
		for (const action of props.actions) {
			let changed = false
			for (const key of dummyOptionIds) {
				if (Object.prototype.hasOwnProperty.call(action.options, key)) {
					delete action.options[key]
					changed = true
				}
			}
			if (changed) updatedActions.push(action)
		}
		return { updatedConfig: null, updatedActions, updatedFeedbacks: [] }
	},
]
