package com.cheaplive.capture

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class PrivateIpPickerTest {
    @Test
    fun `valid private ipv4 accepted`() {
        assertTrue(PrivateIpPicker.isPrivateIpv4("192.168.0.1"))
        assertTrue(PrivateIpPicker.isPrivateIpv4("10.0.0.1"))
        assertTrue(PrivateIpPicker.isPrivateIpv4("172.16.0.1"))
        assertTrue(PrivateIpPicker.isPrivateIpv4("172.31.255.254"))
    }

    @Test
    fun `non private or malformed rejected`() {
        assertFalse(PrivateIpPicker.isPrivateIpv4("8.8.8.8"))
        assertFalse(PrivateIpPicker.isPrivateIpv4("172.32.0.1"))
        assertFalse(PrivateIpPicker.isPrivateIpv4("127.0.0.1"))
        assertFalse(PrivateIpPicker.isPrivateIpv4("not.an.ip"))
        assertFalse(PrivateIpPicker.isPrivateIpv4("1.2.3"))
        assertFalse(PrivateIpPicker.isPrivateIpv4("1.2.3.4.5"))
        assertFalse(PrivateIpPicker.isPrivateIpv4(""))
    }

    @Test
    fun `pick returns null or private IP on dev machine`() {
        // 开发环境可能无局域网，返回 null 即可；若有接口则必为私有
        val ip = PrivateIpPicker.pick()
        if (ip != null) {
            assertTrue(PrivateIpPicker.isPrivateIpv4(ip))
        }
    }
}
