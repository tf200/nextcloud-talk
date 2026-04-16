/**
 * SPDX-FileCopyrightText: 2020 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { getCSPNonce } from '@nextcloud/auth'
import axios from '@nextcloud/axios'
import { showError, showSuccess } from '@nextcloud/dialogs'
import { t } from '@nextcloud/l10n'
import { generateFilePath, generateUrl } from '@nextcloud/router'
import escapeHtml from 'escape-html'
import { fetchConversation } from './services/conversationsService.ts'
import { postRichObjectToConversation } from './services/messagesService.ts'
import { requestRoomSelection } from './utils/requestRoomSelection.js'

import '@nextcloud/dialogs/style.css'

/**
 * @param {object} card The card object given by the deck app
 * @param {number|string} [card.boardId] The board id of the card
 * @param {object} conversation The conversation object given by the RoomSelector
 * @param {string} conversation.token The conversation token
 * @param {string} conversation.displayName The conversation display name
 */
export async function postCardToRoom(card, { token, displayName }) {
	try {
		const response = await postRichObjectToConversation(token, {
			objectType: 'deck-card',
			objectId: card.id,
			metaData: JSON.stringify(card),
		})

		const messageId = response.data.ocs.data.id
		const targetUrl = generateUrl('/call/{token}#message_{messageId}', { token, messageId })

		showSuccess(
			t('spreed', 'Deck card has been posted to {conversation}')
				.replace(/\{conversation}/g, `<a target="_blank" class="external" href="${targetUrl}">${escapeHtml(displayName)} ↗</a>`),
			{
				isHTML: true,
			},
		)
	} catch (exception) {
		console.error('Error posting deck card to conversation', exception, exception.response?.status)
		if (exception.response?.status === 403) {
			showError(t('spreed', 'No permission to post messages in this conversation'))
		} else {
			showError(t('spreed', 'An error occurred while posting deck card to conversation'))
		}
	}
}

class MissingProjectConversationError extends Error {
	constructor(project) {
		super('Project does not have a Talk conversation configured')
		this.name = 'MissingProjectConversationError'
		this.project = project
	}
}

/**
 * @param {number} boardId The deck board id
 * @return {Promise<object>}
 */
async function fetchProjectByBoardId(boardId) {
	const response = await axios.get(generateUrl('/apps/projectcreatoraio/api/v1/projects/board/{boardId}', { boardId }))
	return response.data
}

/**
 * @param {object} project The linked project payload
 * @return {string}
 */
function getProjectConversationLabel(project) {
	return project?.name || project?.label || t('spreed', 'Project chat')
}

/**
 * @param {object} card The card object given by Deck
 * @return {Promise<{token: string, displayName: string}|null>}
 */
async function getProjectConversation(card) {
	const boardId = Number(card?.boardId)
	if (!Number.isFinite(boardId) || boardId <= 0) {
		return null
	}

	let project
	try {
		project = await fetchProjectByBoardId(boardId)
	} catch (exception) {
		if (exception.response?.status === 404) {
			return null
		}

		throw exception
	}

	const token = String(project?.talk_conversation_token || '').trim()
	if (!token) {
		throw new MissingProjectConversationError(project)
	}

	let displayName = getProjectConversationLabel(project)
	try {
		const response = await fetchConversation(token)
		displayName = response.data.ocs.data.displayName || displayName
	} catch (exception) {
		console.debug('Could not fetch project conversation details', exception)
	}

	return { token, displayName }
}

/**
	*
	*/
export function init() {
	if (!window.OCA.Deck) {
		return
	}

	window.OCA.Deck.registerCardAction({
		label: t('spreed', 'Post to a conversation'),
		icon: 'icon-talk',
		callback: async (card) => {
			try {
				const projectConversation = await getProjectConversation(card)
				if (projectConversation) {
					await postCardToRoom(card, projectConversation)
					return
				}

				const conversation = await requestRoomSelection('spreed-post-card-to-room-select', {
					dialogTitle: t('spreed', 'Post to conversation'),
					showPostableOnly: true,
				})
				if (conversation) {
					await postCardToRoom(card, conversation)
				}
			} catch (exception) {
				if (exception instanceof MissingProjectConversationError) {
					showError(t('spreed', 'This project does not have a Talk conversation configured'))
					return
				}

				console.error('Error resolving project conversation for deck card', exception, exception.response?.status)
				showError(t('spreed', 'An error occurred while resolving the project conversation'))
			}
		},
	})
}

// CSP config for webpack dynamic chunk loading
globalThis.__webpack_nonce__ = getCSPNonce()

// Correct the root of the app for chunk loading
// OC.linkTo matches the apps folders
// OC.generateUrl ensure the index.php (or not)
// We do not want the index.php since we're loading files
globalThis.__webpack_public_path__ = generateFilePath('spreed', '', 'js/')

document.addEventListener('DOMContentLoaded', init)
