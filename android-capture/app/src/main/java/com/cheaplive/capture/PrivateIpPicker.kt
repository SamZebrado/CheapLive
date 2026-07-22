package com.cheaplive.capture

import java.net.Inet4Address
import java.net.NetworkInterface

/**
 * 局域网 IPv4 选择：
 * - 枚举 NetworkInterface，过滤 loopback / v6-only / vpn
 * - 只接受 10/8、172.16/12、192.168/16 私有 IPv4
 */
object PrivateIpPicker {

    private val preferredPrefixes = listOf("wlan", "eth", "en", "enp", "wl", "rmnet", "ap")
    private val blockedSubstring = listOf("dummy", "lo", "p2p", "vnic", "veth")

    fun pick(): String? {
        val interfaces: List<NetworkInterface> = try {
            NetworkInterface.getNetworkInterfaces().toList()
        } catch (t: Throwable) {
            emptyList()
        }

        val candidates = mutableListOf<Pair<String, String>>()
        for (netIf: NetworkInterface in interfaces) {
            val name = netIf.name?.lowercase() ?: continue
            if (blockedSubstring.any { name.contains(it) }) continue
            try {
                if (!netIf.isUp || netIf.isLoopback || netIf.isPointToPoint || netIf.isVirtual) continue
            } catch (_: Throwable) {
                continue
            }
            for (addr in netIf.inetAddresses) {
                if (addr !is Inet4Address) continue
                val host = addr.hostAddress ?: continue
                if (isPrivateIpv4(host)) {
                    candidates.add(host to name)
                }
            }
        }

        // 先取 preferred 接口
        val preferred = candidates.firstOrNull { (_, name) ->
            preferredPrefixes.any { name.startsWith(it) }
        }?.first
        return preferred ?: candidates.firstOrNull()?.first
    }

    fun isPrivateIpv4(ip: String): Boolean {
        val parts = ip.split('.')
        if (parts.size != 4) return false
        val nums = parts.map { it.toIntOrNull() ?: -1 }
        if (nums.any { it < 0 || it > 255 }) return false
        return when (nums[0]) {
            10 -> true
            172 -> nums[1] in 16..31
            192 -> nums[1] == 168
            else -> false
        }
    }
}
