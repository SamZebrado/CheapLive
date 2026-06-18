package com.cheaplive.capture

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class SessionManagerTest {
    @Test
    fun `createSession returns valid session`() {
        val s = SessionManager.createSession("192.168.1.10", 8766)
        assertNotNull(s.sessionId)
        assertNotNull(s.token)
        assertTrue(s.sessionId.isNotEmpty())
        assertTrue(s.token.isNotEmpty())
        assertEquals(8766, s.port)
        assertEquals("192.168.1.10", s.privateIp)
    }

    @Test
    fun `consecutive sessions have different sessionId and token`() {
        val a = SessionManager.createSession("192.168.1.10", 8766)
        val b = SessionManager.createSession("192.168.1.10", 8766)
        assertNotEquals(a.sessionId, b.sessionId)
        assertNotEquals(a.token, b.token)
    }
}
