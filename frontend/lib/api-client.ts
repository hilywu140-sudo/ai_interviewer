import axios from 'axios'
import { Project, ProjectCreate, Session, SessionCreate, Message, MessageListResponse, Asset, AssetCreate, AssetUpdate } from './types'
import { getToken, clearToken } from './auth-api'

// 使用空字符串作为 baseURL，让请求使用相对路径
// Next.js 的 rewrites 会将 /api/* 重定向到 http://localhost:8001/api/*
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || ''

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  maxRedirects: 5, // 允许重定向
})

// 请求拦截器 - 添加 Token
apiClient.interceptors.request.use(
  (config) => {
    const token = getToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器 - 处理 401 错误
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // 不在这里自动跳转，让 AuthGuard 处理
    // 只有明确的 401 且不是 /auth/me 请求时才清除 token
    if (error.response?.status === 401) {
      const requestUrl = error.config?.url || ''
      // /auth/me 返回 401 是正常的（token 过期），不要强制跳转
      if (!requestUrl.includes('/auth/me')) {
        clearToken()
      }
    }
    return Promise.reject(error)
  }
)

// Projects API
export const projectsApi = {
  create: async (data: ProjectCreate): Promise<Project> => {
    const response = await apiClient.post('/api/projects', data)
    return response.data
  },

  list: async (): Promise<Project[]> => {
    const response = await apiClient.get('/api/projects')
    return response.data
  },

  get: async (id: string): Promise<Project> => {
    const response = await apiClient.get(`/api/projects/${id}`)
    return response.data
  },

  update: async (id: string, data: Partial<ProjectCreate>): Promise<Project> => {
    const response = await apiClient.put(`/api/projects/${id}`, data)
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/projects/${id}`)
  },

  uploadResume: async (id: string, file: File): Promise<Project> => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await apiClient.post(
      `/api/projects/${id}/upload-resume`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    )
    return response.data
  },
}

// Sessions API
export const sessionsApi = {
  create: async (data: SessionCreate): Promise<Session> => {
    const response = await apiClient.post('/api/sessions', data)
    return response.data
  },

  list: async (projectId?: string): Promise<Session[]> => {
    const params = projectId ? { project_id: projectId } : {}
    const response = await apiClient.get('/api/sessions', { params })
    return response.data
  },

  get: async (id: string): Promise<Session> => {
    const response = await apiClient.get(`/api/sessions/${id}`)
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/sessions/${id}`)
  },
}

// Messages API
export const messagesApi = {
  list: async (
    sessionId: string,
    options?: { limit?: number; offset?: number; order?: 'asc' | 'desc' }
  ): Promise<MessageListResponse> => {
    const params = {
      session_id: sessionId,
      limit: options?.limit || 20,
      offset: options?.offset || 0,
      order: options?.order || 'desc'
    }
    const response = await apiClient.get('/api/messages', { params })
    return response.data
  },
}

// Audio API
export const audioApi = {
  getUrl: async (audioId: string, expiresIn?: number): Promise<{ audio_id: string; url: string; expires_in: number }> => {
    const params = expiresIn ? { expires_in: expiresIn } : {}
    const response = await apiClient.get(`/api/audio/${audioId}/url`, { params })
    return response.data
  },

  triggerCleanup: async (batchSize?: number): Promise<{ deleted: number; failed: number; total_processed: number }> => {
    const params = batchSize ? { batch_size: batchSize } : {}
    const response = await apiClient.post('/api/audio/cleanup', null, { params })
    return response.data
  },
}

// Assets API
export const assetsApi = {
  create: async (data: AssetCreate): Promise<Asset> => {
    const response = await apiClient.post('/api/assets', data)
    return response.data
  },

  list: async (projectId?: string): Promise<{ assets: Asset[], total: number }> => {
    const params = projectId ? { project_id: projectId } : {}
    const response = await apiClient.get('/api/assets', { params })
    return response.data
  },

  get: async (id: string): Promise<Asset> => {
    const response = await apiClient.get(`/api/assets/${id}`)
    return response.data
  },

  update: async (id: string, data: AssetUpdate): Promise<Asset> => {
    const response = await apiClient.put(`/api/assets/${id}`, data)
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/assets/${id}`)
  },

  getVersions: async (id: string): Promise<Asset[]> => {
    const response = await apiClient.get(`/api/assets/${id}/versions`)
    return response.data
  },

  // 确认保存（用于答案优化场景，用户确认后保存）
  confirmSave: async (data: { question: string; transcript: string; project_id: string; message_id?: string }): Promise<{ asset_id: string }> => {
    const response = await apiClient.post('/api/assets/confirm-save', data)
    return response.data
  },
}

export default apiClient
