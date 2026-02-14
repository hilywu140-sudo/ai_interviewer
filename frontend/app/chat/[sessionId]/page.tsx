'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useChat } from '@/hooks/useChat'
import { ChatHeader } from '@/components/chat/ChatHeader'
import { MessageList } from '@/components/chat/MessageList'
import { ChatInput } from '@/components/chat/ChatInput'
import { OptimizedAnswerEditor } from '@/components/chat/OptimizedAnswerEditor'
import { ChatSidebar } from '@/components/sidebar/ChatSidebar'
import { AssetDetailPanel } from '@/components/sidebar/AssetDetailPanel'
import { Asset, MessageContext, AssetUpdate } from '@/lib/types'
import { assetsApi } from '@/lib/api-client'

export default function ChatPage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.sessionId as string

  const {
    state,
    sendMessage,
    setMessageContext,
    submitAudio,
    startRecording,
    stopRecording,
    cancelRecording,
    cancelGeneration,
    clearNewAssetId,
    confirmSave
  } = useChat(sessionId)

  const {
    isConnected,
    messages,
    agentStatus,
    recordingState,
    isSubmitted,
    isStreaming,
    streamingContent,
    isFeedbackStreaming,
    feedbackStreamingContent,
    projectId,
    pendingQuery,
    messageContext,
    newAssetId
  } = state

  // 侧边栏状态
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  // 当前会话标题（从侧边栏获取）
  const [currentSessionTitle, setCurrentSessionTitle] = useState('')

  // 编辑弹窗状态
  const [editingAsset, setEditingAsset] = useState<{ assetId: string; content: string } | null>(null)

  // Asset 详情面板状态
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)

  // 侧边栏刷新触发器
  const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0)

  // 输入框内容（用于取消后恢复）
  const [inputValue, setInputValue] = useState('')

  // 是否禁用输入（录音中或处理中或流式输出中）
  const isInputDisabled = recordingState.isActive || agentStatus === 'thinking' || isStreaming

  // 是否显示停止按钮
  const showStopButton = agentStatus === 'thinking' || isStreaming

  const handleBack = () => {
    router.push('/projects')
  }

  const handleEditAsset = (assetId: string, content: string) => {
    setEditingAsset({ assetId, content })
  }

  const handleSaveAsset = (content: string) => {
    // 保存成功后可以刷新消息或显示提示
    console.log('Asset saved:', content)
  }

  // 更新 Asset（编辑逐字稿）
  const handleUpdateAsset = async (id: string, updates: AssetUpdate) => {
    try {
      const updated = await assetsApi.update(id, updates)
      // 更新选中的 Asset
      setSelectedAsset(updated)
      // 触发侧边栏刷新
      setSidebarRefreshKey(prev => prev + 1)
    } catch (error) {
      console.error('Failed to update asset:', error)
      throw error  // 重新抛出让调用方知道失败了
    }
  }

  // 删除 Asset
  const handleDeleteAsset = async (id: string) => {
    try {
      await assetsApi.delete(id)
      // 关闭详情面板
      setSelectedAsset(null)
      // 触发侧边栏刷新
      setSidebarRefreshKey(prev => prev + 1)
    } catch (error) {
      console.error('Failed to delete asset:', error)
    }
  }

  // 处理侧边栏点击载入按钮时设置上下文
  const handleFillInput = (data: { content: string; context: MessageContext }) => {
    // 设置 messageContext，输入框会显示前缀提示
    setMessageContext(data.context)
    // 如果 content 不是逐字稿内容（而是指令如"帮我撰写逐字稿"），则预填到输入框
    if (data.content && data.content !== data.context.original_transcript) {
      // 计算前缀（与 ChatInput 中的逻辑一致）
      const question = data.context.question
      const prefix = `练习问题是${question.slice(0, 20)}${question.length > 20 ? '...' : ''}，这是它的逐字稿，`
      setInputValue(prefix + data.content)
    }
  }

  // 清除消息上下文
  const handleClearContext = () => {
    setMessageContext(null)
  }

  const handleSessionChange = (newSessionId: string) => {
    router.push(`/chat/${newSessionId}`)
  }

  const handleSendMessage = (content: string) => {
    sendMessage(content)
    setInputValue('')  // 清空输入框
  }

  const handleStopGeneration = () => {
    const restoredQuery = cancelGeneration()
    if (restoredQuery) {
      setInputValue(restoredQuery)  // 恢复用户输入到输入框
    }
  }

  return (
    <div className="flex h-screen bg-white">
      {/* 侧边栏 */}
      {projectId && (
        <ChatSidebar
          projectId={projectId}
          currentSessionId={sessionId}
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
          onFillInput={handleFillInput}
          onSelectAsset={(asset) => setSelectedAsset(asset)}
          onSessionChange={handleSessionChange}
          onCurrentSessionTitle={setCurrentSessionTitle}
          newAssetId={newAssetId}
          onNewAssetShown={clearNewAssetId}
          refreshKey={sidebarRefreshKey}
        />
      )}

      {/* 主聊天区域 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 顶部栏 */}
        <ChatHeader
          isConnected={isConnected}
          agentStatus={agentStatus}
          sessionTitle={currentSessionTitle}
          onBack={handleBack}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          isSidebarOpen={isSidebarOpen}
        />

        {/* 消息列表 */}
        <MessageList
          messages={messages}
          agentStatus={agentStatus}
          recordingState={recordingState}
          isSubmitted={isSubmitted}
          isStreaming={isStreaming}
          streamingContent={streamingContent}
          isFeedbackStreaming={isFeedbackStreaming}
          feedbackStreamingContent={feedbackStreamingContent}
          onStartRecording={startRecording}
          onStopRecording={stopRecording}
          onCancelRecording={cancelRecording}
          onSubmitAudio={submitAudio}
          onEditAsset={handleEditAsset}
          onConfirmSave={confirmSave}
        />

        {/* 输入区域 */}
        <ChatInput
          onSendMessage={handleSendMessage}
          disabled={isInputDisabled}
          value={inputValue}
          onChange={setInputValue}
          showStopButton={showStopButton}
          onStop={handleStopGeneration}
          messageContext={messageContext}
          onClearContext={handleClearContext}
          placeholder={
            recordingState.isActive
              ? '请先完成录音...'
              : isStreaming
              ? 'AI正在生成回复...'
              : agentStatus === 'thinking'
              ? 'AI正在思考...'
              : messageContext
              ? '编辑后发送，AI将帮你优化这个回答'
              : '输入消息，或点击上方快捷按钮'
          }
        />
      </div>

      {/* Asset 详情面板 */}
      {selectedAsset && (
        <AssetDetailPanel
          asset={selectedAsset}
          onClose={() => setSelectedAsset(null)}
          onUpdate={handleUpdateAsset}
          onDelete={handleDeleteAsset}
        />
      )}

      {/* 编辑弹窗 */}
      {editingAsset && (
        <OptimizedAnswerEditor
          assetId={editingAsset.assetId}
          initialContent={editingAsset.content}
          onSave={handleSaveAsset}
          onClose={() => setEditingAsset(null)}
        />
      )}
    </div>
  )
}
