package com.d2rei.buddyoverlay

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.text.InputType
import android.view.ViewGroup
import android.widget.CheckBox
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.d2rei.buddyoverlay.databinding.ActivitySettingsBinding
import kotlinx.coroutines.launch

class SettingsActivity : AppCompatActivity() {
    private lateinit var binding: ActivitySettingsBinding
    private lateinit var repository: BuddyRepository

    private val numericFields = linkedMapOf<String, EditText>()
    private var vibrationCheck: CheckBox? = null
    private var notificationsCheck: CheckBox? = null
    private var uploadUrlField: EditText? = null
    private var sourceIdField: EditText? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivitySettingsBinding.inflate(layoutInflater)
        setContentView(binding.root)
        repository = BuddyRepository.get(this)

        binding.saveSettingsButton.setOnClickListener { save() }
    }

    override fun onResume() {
        super.onResume()
        lifecycleScope.launch { buildForm(repository.loadSettings()) }
    }

    private fun buildForm(settings: BuddySettings) {
        binding.settingsContainer.removeAllViews()
        numericFields.clear()

        addSectionLabel("Postcard capture")
        val capturePrefs = getSharedPreferences(PostcardCaptureService.CAPTURE_PREFS, Context.MODE_PRIVATE)
        uploadUrlField = addTextField(
            "Desktop receiver URL",
            capturePrefs.getString(PostcardCaptureService.KEY_UPLOAD_URL, PostcardCaptureService.DEFAULT_UPLOAD_URL).orEmpty(),
        )
        sourceIdField = addTextField(
            "Phone capture ID",
            capturePrefs.getString(PostcardCaptureService.KEY_SOURCE_ID, PostcardCaptureService.DEFAULT_SOURCE_ID).orEmpty(),
        )
        binding.settingsContainer.addView(Button(this).apply {
            text = "Return to buddy layout"
            isAllCaps = false
            setTextColor(getColor(R.color.textPrimary))
            background = getDrawable(R.drawable.bg_primary_button)
            setOnClickListener {
                getSharedPreferences(BuddyOverlayService.PREFS, Context.MODE_PRIVATE)
                    .edit().putBoolean(BuddyOverlayService.KEY_SNAP_MODE, false).apply()
                ContextCompat.startForegroundService(
                    this@SettingsActivity,
                    Intent(this@SettingsActivity, BuddyOverlayService::class.java)
                        .setAction(BuddyOverlayService.ACTION_BUDDY_MODE),
                )
            }
        })

        addSectionLabel("Buddy tracker")

        addNumberField("Excited threshold EP", "excitedThresholdEp", settings.excitedThresholdEp)
        addNumberField("Initial decay minutes", "decayIntervalMinutes", settings.decayIntervalMinutes)
        addNumberField("Excited decay minutes", "excitedDecayIntervalMinutes", settings.excitedDecayIntervalMinutes)
        addNumberField("Subsequent decay minutes", "subsequentDecayIntervalMinutes", settings.subsequentDecayIntervalMinutes)
        addNumberField("Decay amount EP", "decayAmountEp", settings.decayAmountEp)
        addNumberField("Bubble opacity percent", "bubbleOpacity", (settings.bubbleOpacity * 100).toInt())
        addNumberField("Bubble size dp", "bubbleSizeDp", settings.bubbleSizeDp)

        vibrationCheck = addCheckBox("Vibration enabled", settings.vibrationEnabled)
        notificationsCheck = addCheckBox("Ready notifications enabled", settings.readyNotificationsEnabled)

        binding.settingsContainer.addView(TextView(this).apply {
            text = "Panel opacity is fixed to fully opaque for readability. Replace icon files in res/drawable named ic_buddy_* to customise button art."
            setTextColor(getColor(R.color.textSecondary))
            setPadding(0, dp(4), 0, dp(8))
        })

        BuddyActionType.trackableActions.forEach { action ->
            addSectionLabel(action.displayName)
            addNumberField("${action.displayName} EP", "ep_${action.storageKey}", settings.epFor(action))
            addNumberField("${action.displayName} cooldown minutes", "cd_${action.storageKey}", settings.cooldownMinutesMap[action] ?: 0)
        }
    }

    private fun addSectionLabel(text: String) {
        binding.settingsContainer.addView(TextView(this).apply {
            this.text = text
            textSize = 18f
            setTextColor(getColor(R.color.textPrimary))
            setPadding(0, dp(12), 0, dp(6))
        })
    }

    private fun addNumberField(label: String, key: String, value: Int) {
        val labelView = TextView(this).apply {
            text = label
            setTextColor(getColor(R.color.textSecondary))
        }
        val field = EditText(this).apply {
            inputType = InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_FLAG_SIGNED
            setText(value.toString())
            setTextColor(getColor(R.color.textPrimary))
            background = getDrawable(R.drawable.bg_chip)
            setPadding(dp(10), dp(10), dp(10), dp(10))
        }
        numericFields[key] = field
        binding.settingsContainer.addView(labelView)
        binding.settingsContainer.addView(field)
    }

    private fun addTextField(label: String, value: String): EditText {
        binding.settingsContainer.addView(TextView(this).apply {
            text = label
            setTextColor(getColor(R.color.textSecondary))
        })
        return EditText(this).apply {
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI
            setText(value)
            setTextColor(getColor(R.color.textPrimary))
            background = getDrawable(R.drawable.bg_chip)
            setPadding(dp(10), dp(10), dp(10), dp(10))
            binding.settingsContainer.addView(this)
        }
    }

    private fun addCheckBox(label: String, checked: Boolean): CheckBox =
        CheckBox(this).apply {
            text = label
            isChecked = checked
            setTextColor(getColor(R.color.textPrimary))
            binding.settingsContainer.addView(this)
        }

    private fun save() {
        lifecycleScope.launch {
            val current = repository.loadSettings()
            val actionEpMap = BuddyActionType.trackableActions.associateWith { numeric("ep_${it.storageKey}", current.epFor(it)) }
            val cooldownMap = BuddyActionType.trackableActions.associateWith { numeric("cd_${it.storageKey}", current.cooldownMinutesMap[it] ?: 0) }
            val updated = BuddySettings(
                excitedThresholdEp = numeric("excitedThresholdEp", current.excitedThresholdEp),
                decayIntervalMinutes = numeric("decayIntervalMinutes", current.decayIntervalMinutes),
                excitedDecayIntervalMinutes = numeric("excitedDecayIntervalMinutes", current.excitedDecayIntervalMinutes),
                subsequentDecayIntervalMinutes = numeric("subsequentDecayIntervalMinutes", current.subsequentDecayIntervalMinutes),
                decayAmountEp = numeric("decayAmountEp", current.decayAmountEp),
                bubbleOpacity = (numeric("bubbleOpacity", (current.bubbleOpacity * 100).toInt()).coerceIn(20, 100)) / 100f,
                bubbleSizeDp = numeric("bubbleSizeDp", current.bubbleSizeDp),
                panelOpacity = 1f,
                vibrationEnabled = vibrationCheck?.isChecked ?: current.vibrationEnabled,
                readyNotificationsEnabled = notificationsCheck?.isChecked ?: current.readyNotificationsEnabled,
                actionEpMap = actionEpMap,
                cooldownMinutesMap = cooldownMap,
            )
            repository.saveSettings(updated)
            getSharedPreferences(PostcardCaptureService.CAPTURE_PREFS, Context.MODE_PRIVATE).edit()
                .putString(PostcardCaptureService.KEY_UPLOAD_URL, uploadUrlField?.text?.toString()?.trim())
                .putString(PostcardCaptureService.KEY_SOURCE_ID, sourceIdField?.text?.toString()?.trim()?.ifBlank { PostcardCaptureService.DEFAULT_SOURCE_ID })
                .apply()
            finish()
        }
    }

    private fun numeric(key: String, fallback: Int): Int = numericFields[key]?.text?.toString()?.toIntOrNull() ?: fallback

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()
}
