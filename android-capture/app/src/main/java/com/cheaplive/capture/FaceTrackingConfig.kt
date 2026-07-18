package com.cheaplive.capture

import org.json.JSONObject

/**
 * 面部追踪个体化配置（Capture App 与 Receiver 共享的单一权威配置）。
 *
 * 设计要点：
 * - revision 单调递增，防止旧 patch 覆盖新配置
 * - calibration 是自动校准基线（3 秒中性状态采样），与手动 offset 分开保存
 * - offset 是用户手动微调（眼/嘴 0..1，头角度 度，位置 -1..1）
 * - scale 是灵敏度倍率（0.1..5.0）
 * - 左右眼、左右眉独立
 * - 阶段 A 仅覆盖已确认链路完整的 9 个参数（eye L/R, mouthOpen, mouthSmile, headYaw/Pitch/Roll, positionX/Y）
 *   brow 保留字段但默认 scale=1.0/offset=0.0，等阶段 B 真实数据接入后再开放 UI
 *
 * 变换语义（在 capture/index.html 的 applyFaceTrackingConfig 中实现）：
 * - 眼睛（invert）：opened = clamp(1.0 - max(0,(calib-(raw+offset))*scale) + 0, 0, 1)
 *   说明：raw 是 0..1（1=睁眼），calib 是中性基线，raw<calib 表示更闭
 *         offset 正值让眼睛更睁（先把 raw 抬高再与 calib 比）
 * - 嘴/微笑/眉毛（delta）：out = clamp((raw - calib) * scale + offset, lo, hi)
 * - 头部姿态/位置（center-scale）：out = clamp(center + (raw - center) * scale + offset, lo, hi)
 *   说明：center 来自 calib（如 yawCalib=-2 表示自然头偏左 2 度），offset 平移中性点
 */
data class FaceTrackingConfig(
    val revision: Long = 0L,
    val calibrationEnabled: Boolean = true,
    val calibration: CalibrationData = CalibrationData(),
    val offset: OffsetData = OffsetData(),
    val scale: ScaleData = ScaleData(),
    val enableSmoothing: Boolean = false,
    val smoothingFactor: Float = 0.2f,   // 0..1, 越大越平滑
    val deadZone: Float = 0.02f,         // 仅对 0..1 参数生效
    val autoBlinkDetection: Boolean = true,
) {
    /** 生成下一修订版（不可变拷贝） */
    fun nextRevision(): FaceTrackingConfig = copy(revision = revision + 1L)

    /** 序列化为 JSON（供 WebView / SSE / Receiver 使用） */
    fun toJson(): String = toJsonObject().toString()

    fun toJsonObject(): JSONObject = JSONObject().apply {
        put("revision", revision)
        put("calibrationEnabled", calibrationEnabled)
        put("calibration", calibration.toJsonObject())
        put("offset", offset.toJsonObject())
        put("scale", scale.toJsonObject())
        put("enableSmoothing", enableSmoothing)
        put("smoothingFactor", smoothingFactor.toDouble())
        put("deadZone", deadZone.toDouble())
        put("autoBlinkDetection", autoBlinkDetection)
    }

    companion object {
        fun fromJson(json: String): FaceTrackingConfig = try {
            fromJsonObject(JSONObject(json))
        } catch (_: Throwable) { FaceTrackingConfig() }

        fun fromJsonObject(obj: JSONObject): FaceTrackingConfig {
            return FaceTrackingConfig(
                revision = obj.optLong("revision", 0L),
                calibrationEnabled = obj.optBoolean("calibrationEnabled", true),
                calibration = CalibrationData.fromJsonObject(obj.optJSONObject("calibration") ?: JSONObject()),
                offset = OffsetData.fromJsonObject(obj.optJSONObject("offset") ?: JSONObject()),
                scale = ScaleData.fromJsonObject(obj.optJSONObject("scale") ?: JSONObject()),
                enableSmoothing = obj.optBoolean("enableSmoothing", false),
                smoothingFactor = obj.optDouble("smoothingFactor", 0.2).toFloat(),
                deadZone = obj.optDouble("deadZone", 0.02).toFloat(),
                autoBlinkDetection = obj.optBoolean("autoBlinkDetection", true),
            )
        }
    }
}

/**
 * 自动校准基线（3 秒中性状态采样均值）。
 * sampleCount = 0 表示未校准；校准成功后 ≥30。
 * 所有字段单位与对应原始参数一致（眼/嘴 0..1，头部角度 度，位置 -1..1）。
 */
data class CalibrationData(
    val eyeLeft: Float = 1.0f,
    val eyeRight: Float = 1.0f,
    val mouthOpen: Float = 0.0f,
    val mouthSmile: Float = 0.0f,
    val browLeft: Float = 0.0f,
    val browRight: Float = 0.0f,
    val headYaw: Float = 0.0f,
    val headPitch: Float = 0.0f,
    val headRoll: Float = 0.0f,
    val positionX: Float = 0.0f,
    val positionY: Float = 0.0f,
    val sampleCount: Int = 0,
    val calibratedAt: Long = 0L,
) {
    fun toJsonObject(): JSONObject = JSONObject().apply {
        put("eyeLeft", eyeLeft.toDouble())
        put("eyeRight", eyeRight.toDouble())
        put("mouthOpen", mouthOpen.toDouble())
        put("mouthSmile", mouthSmile.toDouble())
        put("browLeft", browLeft.toDouble())
        put("browRight", browRight.toDouble())
        put("headYaw", headYaw.toDouble())
        put("headPitch", headPitch.toDouble())
        put("headRoll", headRoll.toDouble())
        put("positionX", positionX.toDouble())
        put("positionY", positionY.toDouble())
        put("sampleCount", sampleCount)
        put("calibratedAt", calibratedAt)
    }

    companion object {
        fun fromJsonObject(obj: JSONObject): CalibrationData = CalibrationData(
            eyeLeft = obj.optDouble("eyeLeft", 1.0).toFloat(),
            eyeRight = obj.optDouble("eyeRight", 1.0).toFloat(),
            mouthOpen = obj.optDouble("mouthOpen", 0.0).toFloat(),
            mouthSmile = obj.optDouble("mouthSmile", 0.0).toFloat(),
            browLeft = obj.optDouble("browLeft", 0.0).toFloat(),
            browRight = obj.optDouble("browRight", 0.0).toFloat(),
            headYaw = obj.optDouble("headYaw", 0.0).toFloat(),
            headPitch = obj.optDouble("headPitch", 0.0).toFloat(),
            headRoll = obj.optDouble("headRoll", 0.0).toFloat(),
            positionX = obj.optDouble("positionX", 0.0).toFloat(),
            positionY = obj.optDouble("positionY", 0.0).toFloat(),
            sampleCount = obj.optInt("sampleCount", 0),
            calibratedAt = obj.optLong("calibratedAt", 0L),
        )
    }
}

/**
 * 手动微调偏移（与自动校准独立）。
 * 重新校准默认保留 offset。
 * 单位：眼/嘴 0..1，头部角度 度，位置 -1..1。
 * 范围：眼/嘴 ±0.3，头部角度 ±30，位置 ±0.3。
 */
data class OffsetData(
    val eyeLeft: Float = 0.0f,
    val eyeRight: Float = 0.0f,
    val mouthOpen: Float = 0.0f,
    val mouthSmile: Float = 0.0f,
    val browLeft: Float = 0.0f,
    val browRight: Float = 0.0f,
    val headYaw: Float = 0.0f,
    val headPitch: Float = 0.0f,
    val headRoll: Float = 0.0f,
    val positionX: Float = 0.0f,
    val positionY: Float = 0.0f,
) {
    fun toJsonObject(): JSONObject = JSONObject().apply {
        put("eyeLeft", eyeLeft.toDouble())
        put("eyeRight", eyeRight.toDouble())
        put("mouthOpen", mouthOpen.toDouble())
        put("mouthSmile", mouthSmile.toDouble())
        put("browLeft", browLeft.toDouble())
        put("browRight", browRight.toDouble())
        put("headYaw", headYaw.toDouble())
        put("headPitch", headPitch.toDouble())
        put("headRoll", headRoll.toDouble())
        put("positionX", positionX.toDouble())
        put("positionY", positionY.toDouble())
    }

    companion object {
        fun fromJsonObject(obj: JSONObject): OffsetData = OffsetData(
            eyeLeft = obj.optDouble("eyeLeft", 0.0).toFloat(),
            eyeRight = obj.optDouble("eyeRight", 0.0).toFloat(),
            mouthOpen = obj.optDouble("mouthOpen", 0.0).toFloat(),
            mouthSmile = obj.optDouble("mouthSmile", 0.0).toFloat(),
            browLeft = obj.optDouble("browLeft", 0.0).toFloat(),
            browRight = obj.optDouble("browRight", 0.0).toFloat(),
            headYaw = obj.optDouble("headYaw", 0.0).toFloat(),
            headPitch = obj.optDouble("headPitch", 0.0).toFloat(),
            headRoll = obj.optDouble("headRoll", 0.0).toFloat(),
            positionX = obj.optDouble("positionX", 0.0).toFloat(),
            positionY = obj.optDouble("positionY", 0.0).toFloat(),
        )
    }
}

/**
 * 灵敏度倍率。范围 0.1..5.0，默认 1.0。
 * 左右眼独立；左右眉独立。
 */
data class ScaleData(
    val eyeLeft: Float = 1.0f,
    val eyeRight: Float = 1.0f,
    val mouthOpen: Float = 1.0f,
    val mouthSmile: Float = 1.0f,
    val browLeft: Float = 1.0f,
    val browRight: Float = 1.0f,
    val headYaw: Float = 1.0f,
    val headPitch: Float = 1.0f,
    val headRoll: Float = 1.0f,
    val positionX: Float = 1.0f,
    val positionY: Float = 1.0f,
) {
    fun toJsonObject(): JSONObject = JSONObject().apply {
        put("eyeLeft", eyeLeft.toDouble())
        put("eyeRight", eyeRight.toDouble())
        put("mouthOpen", mouthOpen.toDouble())
        put("mouthSmile", mouthSmile.toDouble())
        put("browLeft", browLeft.toDouble())
        put("browRight", browRight.toDouble())
        put("headYaw", headYaw.toDouble())
        put("headPitch", headPitch.toDouble())
        put("headRoll", headRoll.toDouble())
        put("positionX", positionX.toDouble())
        put("positionY", positionY.toDouble())
    }

    companion object {
        fun fromJsonObject(obj: JSONObject): ScaleData = ScaleData(
            eyeLeft = obj.optDouble("eyeLeft", 1.0).toFloat(),
            eyeRight = obj.optDouble("eyeRight", 1.0).toFloat(),
            mouthOpen = obj.optDouble("mouthOpen", 1.0).toFloat(),
            mouthSmile = obj.optDouble("mouthSmile", 1.0).toFloat(),
            browLeft = obj.optDouble("browLeft", 1.0).toFloat(),
            browRight = obj.optDouble("browRight", 1.0).toFloat(),
            headYaw = obj.optDouble("headYaw", 1.0).toFloat(),
            headPitch = obj.optDouble("headPitch", 1.0).toFloat(),
            headRoll = obj.optDouble("headRoll", 1.0).toFloat(),
            positionX = obj.optDouble("positionX", 1.0).toFloat(),
            positionY = obj.optDouble("positionY", 1.0).toFloat(),
        )
    }
}

/**
 * 校准过程实时状态（不持久化，仅运行时）。
 *
 * 注意：字段为 var，因为 CaptureBridge.submitCalibrationSample 会原地累加 sums 和 sampleCount，
 * 避免每帧创建新对象（采样频率约 10Hz，30 帧累计开销可接受）。
 */
data class CalibrationStatus(
    var inProgress: Boolean = false,
    var startedAt: Long = 0L,
    var sampleCount: Int = 0,
    var targetSamples: Int = 30,    // ≥30 帧（约 3 秒 @ 10Hz）
    var sums: CalibrationSums = CalibrationSums(),
    var lastError: String = "",
)

data class CalibrationSums(
    var eyeLeft: Double = 0.0,
    var eyeRight: Double = 0.0,
    var mouthOpen: Double = 0.0,
    var mouthSmile: Double = 0.0,
    var browLeft: Double = 0.0,
    var browRight: Double = 0.0,
    var headYaw: Double = 0.0,
    var headPitch: Double = 0.0,
    var headRoll: Double = 0.0,
    var positionX: Double = 0.0,
    var positionY: Double = 0.0,
) {
    fun average(count: Int): CalibrationData = if (count <= 0) CalibrationData() else CalibrationData(
        eyeLeft = (eyeLeft / count).toFloat(),
        eyeRight = (eyeRight / count).toFloat(),
        mouthOpen = (mouthOpen / count).toFloat(),
        mouthSmile = (mouthSmile / count).toFloat(),
        browLeft = (browLeft / count).toFloat(),
        browRight = (browRight / count).toFloat(),
        headYaw = (headYaw / count).toFloat(),
        headPitch = (headPitch / count).toFloat(),
        headRoll = (headRoll / count).toFloat(),
        positionX = (positionX / count).toFloat(),
        positionY = (positionY / count).toFloat(),
        sampleCount = count,
        calibratedAt = System.currentTimeMillis(),
    )
}
