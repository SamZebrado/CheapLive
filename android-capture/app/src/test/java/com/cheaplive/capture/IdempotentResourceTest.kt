package com.cheaplive.capture

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test

class IdempotentResourceTest {
    @Test
    fun `duplicate start shares one resource and stop releases once`() {
        var starts = 0
        var stops = 0
        val owner = IdempotentResource<Any> { stops++ }

        val first = owner.getOrStart { starts++; Any() }
        val second = owner.getOrStart { starts++; Any() }

        assertSame(first, second)
        assertEquals(1, starts)
        assertTrue(owner.stop())
        assertFalse(owner.stop())
        assertEquals(1, stops)
        assertNull(owner.peek())
    }

    @Test
    fun `resource can restart after a complete stop`() {
        var starts = 0
        val owner = IdempotentResource<Int> { }
        assertEquals(1, owner.getOrStart { ++starts })
        assertTrue(owner.stop())
        assertEquals(2, owner.getOrStart { ++starts })
        assertEquals(2, starts)
    }

    @Test
    fun `failed start is not retained and a later start can recover`() {
        val owner = IdempotentResource<Int> { }
        var failed = false

        try {
            owner.getOrStart { throw IllegalStateException("occupied") }
        } catch (_: IllegalStateException) {
            // Expected: a bind failure must not poison the lifetime owner.
            failed = true
        }

        assertTrue(failed)
        assertNull(owner.peek())
        assertEquals(7, owner.getOrStart { 7 })
    }
}
