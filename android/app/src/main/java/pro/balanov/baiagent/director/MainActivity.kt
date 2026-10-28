package pro.balanov.baiagent.director

import android.app.Activity
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.InputType
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.HorizontalScrollView
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.ScrollView
import android.widget.TextView
import android.content.Intent
import android.net.Uri
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL
import java.net.URLEncoder
import java.util.concurrent.Executors

class MainActivity : Activity() {
    private val worker = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())
    private lateinit var content: LinearLayout
    private lateinit var input: EditText
    private var running = false
    private var analysis: Analysis? = null

    private val ink = Color.rgb(22, 38, 34)
    private val muted = Color.rgb(92, 108, 103)
    private val green = Color.rgb(23, 107, 85)
    private val pale = Color.rgb(232, 244, 238)
    private val line = Color.rgb(218, 227, 223)

    data class Source(val id: String, val title: String, val url: String, val text: String, val companyName: String)
    data class Opportunity(val title: String, val why: String, val action: String, val metric: String, val sourceId: String, val quote: String)
    data class Analysis(val companyName: String, val requestedUrl: String, val sources: List<Source>, val opportunities: List<Opportunity>)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val scroll = ScrollView(this).apply { isFillViewport = true; setBackgroundColor(Color.rgb(245, 247, 250)) }
        content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(18), dp(20), dp(32))
        }
        scroll.addView(content, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        setContentView(scroll)
        showWelcome()
    }

    override fun onDestroy() {
        worker.shutdownNow()
        super.onDestroy()
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()
    private fun text(value: String, size: Float = 16f, color: Int = ink, bold: Boolean = false): TextView = TextView(this).apply {
        text = value
        textSize = size
        setTextColor(color)
        setLineSpacing(0f, 1.16f)
        if (bold) setTypeface(typeface, Typeface.BOLD)
    }
    private fun box(color: Int = Color.WHITE, radius: Int = 18, stroke: Int = 0): GradientDrawable = GradientDrawable().apply {
        setColor(color)
        cornerRadius = dp(radius).toFloat()
        if (stroke > 0) setStroke(dp(1), stroke)
    }
    private fun margins(view: View, top: Int = 0, bottom: Int = 0): View {
        (view.layoutParams as? LinearLayout.LayoutParams)?.setMargins(0, dp(top), 0, dp(bottom))
        return view
    }
    private fun add(view: View, top: Int = 0, bottom: Int = 0) {
        content.addView(view, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        margins(view, top, bottom)
    }
    private fun action(label: String, primary: Boolean = true, onClick: () -> Unit): Button = Button(this).apply {
        text = label
        textSize = 15f
        isAllCaps = false
        setTextColor(if (primary) Color.WHITE else green)
        setTypeface(typeface, Typeface.BOLD)
        background = box(if (primary) green else pale, 13)
        setPadding(dp(16), dp(6), dp(16), dp(6))
        setOnClickListener { onClick() }
    }
    private fun header() {
        val row = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
        val logo = ImageView(this).apply {
            setImageResource(R.drawable.baiagent_logo)
            scaleType = ImageView.ScaleType.FIT_CENTER
            setOnClickListener { open("https://baiagent.ru/") }
        }
        row.addView(logo, LinearLayout.LayoutParams(dp(38), dp(38)))
        val brand = text("BAIagent", 20f, ink, true).apply { setPadding(dp(10), 0, 0, 0); setOnClickListener { open("https://baiagent.ru/") } }
        row.addView(brand, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
        val director = text("ИИ-директор", 14f, green, true)
        row.addView(director)
        val founder = ImageView(this).apply {
            setImageResource(R.drawable.balanov_logo)
            scaleType = ImageView.ScaleType.FIT_CENTER
            setPadding(dp(10), 0, 0, 0)
            setOnClickListener { open("https://balanov.pro/") }
        }
        row.addView(founder, LinearLayout.LayoutParams(dp(46), dp(38)))
        add(row, 0, 28)
    }
    private fun clear() { content.removeAllViews(); header() }

    private fun showWelcome() {
        running = false
        analysis = null
        clear()
        add(text("БЕСПЛАТНЫЙ ИИ-ДИРЕКТОР ДЛЯ БИЗНЕСА", 12f, green, true), 8, 12)
        add(text("Ваш бизнес.\nУже понял, с чего начать.", 31f, ink, true), 0, 14)
        add(text("Просто укажите сайт. Система сама узнает компанию, найдёт конкретные возможности и покажет, откуда взялся каждый вывод.", 17f, muted), 0, 22)
        input = EditText(this).apply {
            hint = "например, company.ru"
            textSize = 17f
            setTextColor(ink)
            setHintTextColor(Color.rgb(130, 143, 138))
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI
            setSingleLine(true)
            background = box(Color.WHITE, 13, line)
            setPadding(dp(16), dp(4), dp(16), dp(4))
        }
        add(input, 0, 12)
        add(action("Узнать мой бизнес") {
            val value = input.text.toString().trim()
            if (value.isNotEmpty() && !running) research(value)
        }, 0, 18)
        val promises = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(18), dp(16), dp(18), dp(16))
            background = box(pale, 16)
        }
        listOf("✓  0 ₽ за анализ", "✓  Без анкет и API-ключей", "✓  Выводы с точными источниками").forEach {
            promises.addView(text(it, 15f, green, true), LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { bottomMargin = dp(7) })
        }
        add(promises, 0, 22)
        val steps = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(20), dp(20), dp(20), dp(20)); background = box() }
        steps.addView(text("Что вы получите за один запуск", 19f, ink, true))
        listOf("Узнаю компанию по её реальному сайту", "Покажу несколько вариантов — выберите сами", "Объясню логику и способ измерить результат").forEachIndexed { index, item ->
            steps.addView(text("0${index + 1}   $item", 16f, ink), LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(17) })
        }
        add(steps, 0, 18)
        add(text("Открытое исследование требует интернет. Это не заключение аудита: предложения нужно проверить на реальных данных компании.", 13f, muted), 4, 16)
        add(action("Скачать прайс BAIagent (.xlsx)", false) { open("https://baiagent.ru/xray/downloads/BAIagent-B2B-price.xlsx") })
    }

    private fun research(rawUrl: String) {
        running = true
        clear()
        add(text("ИИ-ДИРЕКТОР УЖЕ РАБОТАЕТ", 12f, green, true), 16, 12)
        add(text("Знакомлюсь с вашим бизнесом", 28f, ink, true), 0, 10)
        val status = text("Читаю сайт, продукты и открытые материалы.", 17f, muted)
        add(status, 0, 24)
        val progress = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply { isIndeterminate = true; max = 100 }
        add(progress, 0, 28)
        val card = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(20), dp(20), dp(20), dp(20)); background = box() }
        card.addView(text("Понятный процесс — ничего делать не нужно", 18f, ink, true))
        card.addView(text("1. Узнаю вашу компанию\n\n2. Нахожу рабочие сценарии\n\n3. Связываю предложения с конкретными основаниями\n\n4. Оставляю только проверяемые цитаты", 16f, muted), LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(18) })
        add(card)
        worker.execute {
            try {
                main.post { if (!isDestroyed) status.text = "Нахожу рабочие сценарии и проверяю точные цитаты…" }
                val result = fetchAndAnalyze(rawUrl)
                main.post { if (!isDestroyed) { running = false; analysis = result; showResult(result, 0) } }
            } catch (error: Exception) {
                main.post { if (!isDestroyed) showError(error.message ?: "Не удалось исследовать сайт") }
            }
        }
    }

    private fun showError(message: String) {
        running = false
        clear()
        add(text("Не получилось открыть сайт", 27f, ink, true), 24, 12)
        add(text(message, 16f, muted), 0, 12)
        add(text("Проверьте адрес, интернет и доступность сайта. Попробуйте ещё раз или укажите другой публичный сайт.", 15f, muted), 0, 22)
        add(action("Попробовать другой сайт") { showWelcome() })
    }

    private fun fetchAndAnalyze(rawUrl: String): Analysis {
        val encoded = URLEncoder.encode(rawUrl, "UTF-8")
        val connection = URL("https://baiagent.ru/xray/api/research.php?url=$encoded").openConnection() as HttpURLConnection
        connection.connectTimeout = 15000
        connection.readTimeout = 90000
        connection.requestMethod = "GET"
        connection.setRequestProperty("Accept", "application/json")
        connection.setRequestProperty("User-Agent", "BAIagentDirectorAndroid/0.3")
        try {
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val bytes = ByteArrayOutputStream()
            val buffer = ByteArray(8192)
            var total = 0
            while (true) {
                val count = stream.read(buffer)
                if (count < 0) break
                total += count
                if (total > 3_000_000) throw IllegalStateException("Ответ сервера слишком большой")
                bytes.write(buffer, 0, count)
            }
            val json = JSONObject(bytes.toString("UTF-8"))
            if (status !in 200..299) throw IllegalStateException(json.optString("error", "Сервер исследования недоступен"))
            val sourceJson = json.getJSONArray("sources")
            val sources = mutableListOf<Source>()
            for (index in 0 until sourceJson.length()) {
                val item = sourceJson.getJSONObject(index)
                val body = item.optString("text")
                if (body.length >= 20) sources.add(Source(item.getString("id"), item.optString("title", "Источник"), item.optString("url"), body, item.optString("companyName")))
            }
            if (sources.isEmpty()) throw IllegalStateException("Не удалось получить текст открытых источников")
            val requestedUrl = json.optString("requestedUrl", rawUrl)
            val company = sources.firstOrNull { it.companyName.isNotBlank() }?.companyName
                ?: json.optString("companyName").ifBlank { URI(requestedUrl).host?.removePrefix("www.") ?: "Компания" }
            return Analysis(company, requestedUrl, sources, opportunities(sources))
        } finally {
            connection.disconnect()
        }
    }

    private fun normalized(value: String): String = value.replace(Regex("\\s+"), " ").trim().lowercase()
    private fun quoteFor(source: Source, pattern: Regex): String {
        val sentences = source.text.split(Regex("(?<=[.!?…])\\s+")).filter { it.trim().length >= 20 }
        val matching = sentences.filter { pattern.containsMatchIn(it) }.sortedBy { it.length }
        val selected = (matching.firstOrNull() ?: sentences.firstOrNull() ?: source.text).trim()
        if (selected.length <= 280) return selected
        val match = pattern.find(selected)
        if (match == null) return selected.take(280).trim()
        var start = (match.range.first - 100).coerceAtLeast(0)
        var end = (start + 280).coerceAtMost(selected.length)
        if (end - start < 280) start = (end - 280).coerceAtLeast(0)
        if (start > 0) {
            val boundary = selected.indexOf(' ', start)
            if (boundary in start until match.range.first) start = boundary + 1
        }
        if (end < selected.length) {
            val boundary = selected.lastIndexOf(' ', end)
            if (boundary > start + 120) end = boundary
        }
        return selected.substring(start, end).trim()
    }

    private fun opportunities(sources: List<Source>): List<Opportunity> {
        data class Definition(val pattern: Regex, val title: String, val why: String, val action: String, val metric: String)
        val definitions = listOf(
            Definition(Regex("цен[аыуеой]|стоимост|прайс|price|pricing|тариф", RegexOption.IGNORE_CASE), "Ускорить ответы на вопросы о стоимости", "На сайте уже есть информация о ценах или условиях. Значит, типовой ответ можно собирать из утверждённых данных, а менеджеру оставлять только нестандартные случаи.", "Собрать утверждённые правила ответов и провести ограниченный пилот на обезличенных обращениях.", "Время первого ответа и доля ответов, принятых без исправлений."),
            Definition(Regex("услуг|сервис|продукт|решени|продукц|service|product|solution", RegexOption.IGNORE_CASE), "Подготовить первичную консультацию по продуктам", "Описания продуктов уже опубликованы. Проверяемая гипотеза — использовать их как источник для черновика консультации без выдумывания условий.", "Сформировать базу ответов только из подтверждённых материалов и проверить её на типовых вопросах.", "Полнота и корректность ответов на эталонном наборе вопросов."),
            Definition(Regex("контакт|почт|телефон|связаться|contact|email|phone|@", RegexOption.IGNORE_CASE), "Упростить маршрутизацию входящих обращений", "Контактный канал опубликован, поэтому можно отдельно проверить классификацию обращений и подготовку карточки для ответственного.", "Настроить черновую классификацию с журналом и обязательной проверкой человеком.", "Доля корректно классифицированных обращений и число потерянных обращений.")
        )
        val result = definitions.mapNotNull { definition ->
            val source = sources.firstOrNull { definition.pattern.containsMatchIn(it.text) } ?: return@mapNotNull null
            val quote = quoteFor(source, definition.pattern)
            if (!normalized(source.text).contains(normalized(quote))) return@mapNotNull null
            Opportunity(definition.title, definition.why, definition.action, definition.metric, source.id, quote)
        }.toMutableList()
        if (result.isEmpty()) {
            val source = sources.first()
            result.add(Opportunity("Подготовить базу ответов по материалам компании", "Предложение опирается на опубликованные материалы. Перед запуском нужно подтвердить процесс и измерить пользу на реальных данных.", "Собрать утверждённые материалы и проверить черновые ответы на эталонном наборе вопросов.", "Полнота и корректность ответов, подтверждённых источниками.", source.id, quoteFor(source, Regex("."))))
        }
        return result
    }

    private fun showResult(result: Analysis, selectedIndex: Int) {
        clear()
        val selected = result.opportunities[selectedIndex]
        add(text("✓  КОМПАНИЯ РАСПОЗНАНА", 12f, green, true), 8, 10)
        add(text(result.companyName, 29f, ink, true), 0, 4)
        add(action(try { URI(result.requestedUrl).host?.removePrefix("www.") ?: result.requestedUrl } catch (_: Exception) { result.requestedUrl }, false) { open(result.requestedUrl) }, 0, 18)
        val stats = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; setPadding(dp(16), dp(16), dp(16), dp(16)); background = box(pale, 16) }
        listOf("${result.sources.size}\nисточников", "${result.opportunities.size}\nварианта", "14\nдней пилота", "0 ₽\nза анализ").forEach { item ->
            stats.addView(text(item, 16f, green, true).apply { gravity = Gravity.CENTER }, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
        }
        add(stats, 0, 24)
        add(text("Что можно улучшить в первую очередь", 23f, ink, true), 0, 6)
        add(text("Выберите вариант. Внутри — действие, логика, цитата и способ измерить результат.", 15f, muted), 0, 16)
        val tabs = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        result.opportunities.forEachIndexed { index, opportunity ->
            val tab = action("0${index + 1}  ${opportunity.title}", index == selectedIndex) { showResult(result, index) }
            tabs.addView(tab, LinearLayout.LayoutParams(dp(255), ViewGroup.LayoutParams.WRAP_CONTENT).apply { rightMargin = dp(10) })
        }
        val tabScroll = HorizontalScrollView(this).apply { isHorizontalScrollBarEnabled = false; addView(tabs) }
        add(tabScroll, 0, 18)
        val card = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(20), dp(20), dp(20), dp(20)); background = box() }
        card.addView(text("ПРЕДЛАГАЮ НАЧАТЬ ЗДЕСЬ", 12f, green, true))
        card.addView(text(selected.title, 23f, ink, true), LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(10); bottomMargin = dp(18) })
        card.addView(text("Почему это может помочь", 14f, green, true))
        card.addView(text(selected.why, 16f, ink), LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(7); bottomMargin = dp(18) })
        card.addView(text("Что именно сделать", 14f, green, true))
        card.addView(text(selected.action, 16f, ink, true), LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(7); bottomMargin = dp(18) })
        card.addView(text("Какой эффект проверяем за 14 дней", 14f, green, true))
        card.addView(text(selected.metric, 16f, ink), LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(7); bottomMargin = dp(18) })
        card.addView(text("До запуска: замеряем текущий показатель\nПосле пилота: сравниваем измеренный результат", 15f, muted), LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { bottomMargin = dp(18) })
        card.addView(text("ТОЧНАЯ ЦИТАТА ИЗ ИСТОЧНИКА", 12f, green, true))
        card.addView(text("«${selected.quote}»", 16f, ink), LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(9); bottomMargin = dp(14) })
        card.addView(action("Открыть основание", false) {
            result.sources.firstOrNull { it.id == selected.sourceId }?.let { open(it.url) }
        })
        add(card, 0, 18)
        val sourcesCard = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(20), dp(20), dp(20), dp(20)); background = box() }
        sourcesCard.addView(text("Вот откуда это взято", 20f, ink, true))
        sourcesCard.addView(text("Нажмите на источник и проверьте сами.", 14f, muted), LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(5); bottomMargin = dp(10) })
        result.sources.forEach { source -> sourcesCard.addView(action("↗  ${source.title}", false) { open(source.url) }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(8) }) }
        add(sourcesCard, 0, 18)
        add(text("Для точного расчёта нужны внутренние обращения, регламенты и текущие показатели. Полная версия для локальных документов доступна на ПК.", 15f, muted), 0, 12)
        add(action("Перейти на baiagent.ru") { open("https://baiagent.ru/") }, 0, 10)
        add(action("Скачать прайс BAIagent (.xlsx)", false) { open("https://baiagent.ru/xray/downloads/BAIagent-B2B-price.xlsx") }, 0, 10)
        add(action("Исследовать другой сайт", false) { showWelcome() })
    }

    private fun open(url: String) {
        if (!url.startsWith("https://") && !url.startsWith("http://")) return
        try { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) } catch (_: Exception) { }
    }
}
