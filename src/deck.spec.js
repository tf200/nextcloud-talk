/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import axios from '@nextcloud/axios'
import { showError } from '@nextcloud/dialogs'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { init } from './deck.js'
import { fetchConversation } from './services/conversationsService.ts'
import { postRichObjectToConversation } from './services/messagesService.ts'
import { requestRoomSelection } from './utils/requestRoomSelection.js'

vi.mock('@nextcloud/auth', () => ({
	getCSPNonce: vi.fn(() => 'nonce'),
}))

vi.mock('@nextcloud/axios', () => ({
	default: {
		get: vi.fn(),
	},
}))

vi.mock('@nextcloud/l10n', () => ({
	t: vi.fn((app, text) => text),
}))

vi.mock('@nextcloud/router', () => ({
	generateFilePath: vi.fn(() => '/js/'),
	generateUrl: vi.fn((url, params = {}) => url.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? `{${key}}`))),
}))

vi.mock('@nextcloud/dialogs/style.css', () => ({}))

vi.mock('./services/conversationsService.ts', () => ({
	fetchConversation: vi.fn(),
}))

vi.mock('./services/messagesService.ts', () => ({
	postRichObjectToConversation: vi.fn(),
}))

vi.mock('./utils/requestRoomSelection.js', () => ({
	requestRoomSelection: vi.fn(),
}))

describe('deck integration', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		window.OCA.Deck = {
			registerCardAction: vi.fn(),
		}
		postRichObjectToConversation.mockResolvedValue({
			data: {
				ocs: {
					data: {
						id: 42,
					},
				},
			},
		})
	})

	function getRegisteredCallback() {
		init()
		expect(window.OCA.Deck.registerCardAction).toHaveBeenCalledTimes(1)
		return window.OCA.Deck.registerCardAction.mock.calls[0][0].callback
	}

	test('falls back to room selector for legacy deck payloads without board id', async () => {
		requestRoomSelection.mockResolvedValue({
			token: 'legacy-room',
			displayName: 'Legacy room',
		})

		const callback = getRegisteredCallback()
		await callback({ id: '10', name: 'Card title' })

		expect(requestRoomSelection).toHaveBeenCalledTimes(1)
		expect(axios.get).not.toHaveBeenCalled()
		expect(postRichObjectToConversation).toHaveBeenCalledWith('legacy-room', expect.objectContaining({
			objectType: 'deck-card',
			objectId: '10',
		}))
	})

	test('posts directly to the project conversation when board belongs to a project', async () => {
		axios.get.mockResolvedValue({
			data: {
				id: 7,
				name: 'Project Alpha',
				talk_conversation_token: 'project-room',
			},
		})
		fetchConversation.mockResolvedValue({
			data: {
				ocs: {
					data: {
						displayName: 'Project Alpha - Chat',
					},
				},
			},
		})

		const callback = getRegisteredCallback()
		await callback({ id: '11', boardId: 99, name: 'Card title' })

		expect(axios.get).toHaveBeenCalledTimes(1)
		expect(fetchConversation).toHaveBeenCalledWith('project-room')
		expect(requestRoomSelection).not.toHaveBeenCalled()
		expect(postRichObjectToConversation).toHaveBeenCalledWith('project-room', expect.objectContaining({
			objectType: 'deck-card',
			objectId: '11',
		}))
	})

	test('shows an error when a project board has no Talk conversation token', async () => {
		axios.get.mockResolvedValue({
			data: {
				id: 7,
				name: 'Project Alpha',
				talk_conversation_token: '',
			},
		})

		const callback = getRegisteredCallback()
		await callback({ id: '12', boardId: 99, name: 'Card title' })

		expect(requestRoomSelection).not.toHaveBeenCalled()
		expect(postRichObjectToConversation).not.toHaveBeenCalled()
		expect(showError).toHaveBeenCalledWith('This project does not have a Talk conversation configured')
	})

	test('keeps the selector flow when the board is not linked to a project', async () => {
		axios.get.mockRejectedValue({
			response: {
				status: 404,
			},
		})
		requestRoomSelection.mockResolvedValue({
			token: 'selected-room',
			displayName: 'Selected room',
		})

		const callback = getRegisteredCallback()
		await callback({ id: '13', boardId: 99, name: 'Card title' })

		expect(requestRoomSelection).toHaveBeenCalledTimes(1)
		expect(postRichObjectToConversation).toHaveBeenCalledWith('selected-room', expect.objectContaining({
			objectId: '13',
		}))
	})
})
