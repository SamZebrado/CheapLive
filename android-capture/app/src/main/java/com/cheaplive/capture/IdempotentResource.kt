package com.cheaplive.capture

/** Thread-safe ownership for resources that must have at most one live instance. */
class IdempotentResource<T>(private val release: (T) -> Unit) {
    private var current: T? = null

    @Synchronized
    fun getOrStart(factory: () -> T): T {
        current?.let { return it }
        return factory().also { current = it }
    }

    @Synchronized
    fun peek(): T? = current

    @Synchronized
    fun stop(): Boolean {
        val value = current ?: return false
        current = null
        release(value)
        return true
    }
}
