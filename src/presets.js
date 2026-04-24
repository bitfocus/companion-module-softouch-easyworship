const { combineRgb } = require('@companion-module/base')
const images = require('./presets-images')

/**
 * Preset button definitions — the pre-made buttons users can drag into
 * their button layout. Each preset pairs a PNG icon with an action and
 * an optional feedback for highlighting.
 *
 * The base64 PNG blobs live in presets-images.js to keep this file
 * readable and diff-friendly.
 */
function getPresets(_instance) {
	const presets = []

	const txtalign = 'center:bottom'
	const pngalign = 'center:top'
	const txtcolor = combineRgb(255, 255, 255)
	const bkgcolor = combineRgb(0, 0, 0)
	const feedbkgcolor = combineRgb(255, 204, 102)

	const startButton = { category: 'Commands', text: 'Pres Start', txtsize: '14', action: 'presstart', feedback: 'is_none', png64: images.PressStartPng }

	const buttons = [
		{ category: 'Commands', text: '', txtsize: '14', action: 'logo', feedback: 'is_logo', png64: images.LogoPng },
		{ category: 'Commands', text: '', txtsize: '14', action: 'black', feedback: 'is_black', png64: images.BlackPng },
		{ category: 'Commands', text: '', txtsize: '14', action: 'clear', feedback: 'is_clear', png64: images.ClearPng },
		{ category: 'Commands', text: '', txtsize: '14', action: 'play', feedback: 'is_none', png64: images.PlayPng },
		{ category: 'Commands', text: '', txtsize: '14', action: 'pause', feedback: 'is_none', png64: images.PausePng },
		{ category: 'Commands', text: '', txtsize: '14', action: 'toggle', feedback: 'is_none', png64: images.TogglePng },
		{ category: 'Commands', text: '', txtsize: '14', action: 'prevsched', feedback: 'is_none', png64: images.PrevSchedulePng },
		{ category: 'Commands', text: '', txtsize: '14', action: 'nextsched', feedback: 'is_none', png64: images.NextSchedulePng },
		{ category: 'Commands', text: '', txtsize: '14', action: 'prevbuild', feedback: 'is_none', png64: images.PrevBuildPng },
		{ category: 'Commands', text: '', txtsize: '14', action: 'nextbuild', feedback: 'is_none', png64: images.NextBuildPng },
		{ category: 'Commands', text: '', txtsize: '14', action: 'slidestart', feedback: 'is_none', png64: images.SlideStartPng },
		startButton,
		{ category: 'Commands', text: '', txtsize: '14', action: 'connectezw', feedback: 'is_none', png64: images.ConnectPng },
		{ category: 'Commands', text: '', txtsize: '14', action: 'gotoslide', feedback: 'is_none', png64: images.GotoSlidePng },
		{ category: 'Commands', text: '', txtsize: '14', action: 'gotoschedule', feedback: 'is_none', png64: images.GotoSchedulePng },
	]

	buttons.forEach((button) => {
		const preset = {
			type: 'button',
			category: button.category,
			name: `${button.text} Command`,
			style: {
				text: button.text,
				size: button.txtsize,
				color: txtcolor,
				bgcolor: bkgcolor,
				png64: button.png64,
				pngalignment: pngalign,
				alignment: txtalign,
			},
			steps: [{
				down: [{
					actionId: button.action,
					options: {},
				}],
				up: [],
			}],
			feedbacks: [],
		}

		// Schedule navigation chains Presentation Start so the newly-active
		// schedule item opens on slide 1, not wherever EW last left off.
		if (button.action.includes('sched')) {
			preset.steps[0].down.push({
				actionId: startButton.action,
				options: {},
			})
		}

		// Logo/Black/Clear buttons get a highlight feedback matching their state
		if (button.feedback === 'is_logo' || button.feedback === 'is_black' || button.feedback === 'is_clear') {
			preset.feedbacks.push({
				feedbackId: button.feedback,
				options: {},
				style: {
					bgcolor: feedbkgcolor,
					color: bkgcolor,
					png64: button.png64,
				},
			})
		}

		presets.push(preset)
	})

	return presets
}

module.exports = { getPresets }
