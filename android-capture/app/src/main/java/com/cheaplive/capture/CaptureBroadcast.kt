package com.cheaplive.capture

/**
 * 向 WebSocket 广播面捕帧的最小接口：
 *   - 生产代码由 LocalServer 实现
 *   - 单元测试由测试桩实现
 */
interface CaptureBroadcast {
    fun broadcastFrame(json: String)
}
