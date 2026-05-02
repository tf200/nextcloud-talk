<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<script setup>
import { showError, showSuccess } from '@nextcloud/dialogs'
import { t } from '@nextcloud/l10n'
import { computed, onMounted, ref } from 'vue'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcDialog from '@nextcloud/vue/components/NcDialog'
import NcLoadingIcon from '@nextcloud/vue/components/NcLoadingIcon'
import NcTextArea from '@nextcloud/vue/components/NcTextArea'
import { getRecordingFileContent, shareEditedRecordingFile } from '../../services/recordingService.js'

const props = defineProps({
	token: {
		type: String,
		required: true,
	},
	fileId: {
		type: Number,
		required: true,
	},
	timestamp: {
		type: Number,
		required: true,
	},
})

const emit = defineEmits(['close', 'shared'])

const isLoading = ref(true)
const isSharing = ref(false)
const content = ref('')
const fileName = ref('')
const fileType = ref('transcript')

const dialogTitle = computed(() => fileType.value === 'summary'
	? t('spreed', 'Edit summary before sharing')
	: t('spreed', 'Edit transcript before sharing'))

const shareLabel = computed(() => fileType.value === 'summary'
	? t('spreed', 'Share edited summary')
	: t('spreed', 'Share edited transcript'))

const isSubmitDisabled = computed(() => isLoading.value || isSharing.value || content.value.trim() === '')

onMounted(async () => {
	try {
		const response = await getRecordingFileContent(props.token, props.fileId)
		const data = response.data.ocs.data
		content.value = data.content
		fileName.value = data.name
		fileType.value = data.type
	} catch (error) {
		console.error(error)
		showError(t('spreed', 'Could not load the recording file for editing'))
		emit('close')
	} finally {
		isLoading.value = false
	}
})

/**
 * Share the edited recording file content to the conversation.
 */
async function shareEditedFile() {
	if (isSubmitDisabled.value) {
		return
	}

	isSharing.value = true
	try {
		await shareEditedRecordingFile(props.token, props.fileId, props.timestamp, content.value)
		showSuccess(t('spreed', 'Edited recording file shared to chat'))
		emit('shared')
	} catch (error) {
		console.error(error)
		showError(t('spreed', 'Could not share the edited recording file'))
	} finally {
		isSharing.value = false
	}
}
</script>

<template>
	<NcDialog
		:name="dialogTitle"
		@update:open="emit('close')">
		<div class="recording-file-edit-dialog">
			<NcLoadingIcon v-if="isLoading" :size="44" />
			<template v-else>
				<p class="recording-file-edit-dialog__file-name">
					{{ fileName }}
				</p>
				<NcTextArea
					v-model="content"
					class="recording-file-edit-dialog__editor"
					:label="t('spreed', 'Markdown content')"
					:disabled="isSharing" />
			</template>
		</div>

		<template #actions>
			<NcButton :disabled="isSharing" @click="emit('close')">
				{{ t('spreed', 'Cancel') }}
			</NcButton>
			<NcButton
				variant="primary"
				:disabled="isSubmitDisabled"
				@click="shareEditedFile">
				{{ shareLabel }}
			</NcButton>
		</template>
	</NcDialog>
</template>

<style lang="scss" scoped>
.recording-file-edit-dialog {
	min-width: min(760px, 80vw);
	min-height: 420px;
	display: flex;
	flex-direction: column;
	justify-content: center;
}

.recording-file-edit-dialog__file-name {
	margin-block: 0 12px;
	font-weight: 600;
}

.recording-file-edit-dialog__editor {
	min-height: 360px;
}

:deep(textarea) {
	min-height: 360px;
	font-family: var(--font-face-monospace);
}
</style>
