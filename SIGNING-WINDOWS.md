# Подписание Windows-релиза BAIagent Director

## Что уже подготовлено

- `npm run dist:win` сохраняет обычную локальную сборку без обязательной подписи.
- `npm run dist:win:signed` запускает preflight, затем собирает приложение и NSIS-установщик с Authenticode, SHA-256 и RFC 3161 timestamp. По умолчанию результат попадает в `release-signed`, а не в каталог текущего релиза.
- `scripts/check-windows-signing.ps1` до начала сборки проверяет наличие однозначно выбранного действующего сертификата с закрытым ключом, Node.js и npm.
- В подписанном режиме `forceCodeSigning: true`: сборка завершится ошибкой, если подписать файлы не удалось.
- `scripts/verify-windows-signature.ps1` проверяет подпись, timestamp, издателя, отпечаток и SHA-256 основного EXE и установщика.
- Пароль, PIN токена, TOTP-секрет и закрытый ключ в проект не добавляются.

Текущий публичный релиз `0.8.1` остаётся неподписанным. Его нельзя незаметно заменить подписанным файлом с тем же именем: изменятся байты файла, SHA-256 и поведение проверки целостности. Первый подписанный установщик нужно выпускать как новую версию.

## 1. Получить сертификат

Для прямых загрузок с `baiagent.ru` нужен публично доверенный Code Signing / Authenticode сертификат, а не TLS-сертификат для сайта. Подготовленный маршрут — SSL.com **IV** для физического лица либо **OV** для организации с **eSigner for Code + eSigner CKA**. Это позволяет использовать облачный HSM без доставки USB-токена и загружать сертификат в Windows certificate store для electron-builder.

До заказа отправить поставщику готовый запрос из `SIGNING-PROVIDER-REQUEST.md` и получить письменные подтверждения:

1. Выпуск и оплата доступны заявителю из России; известны полная стоимость и принимаемые документы.
2. Согласовано точное имя издателя, которое должно отображаться в Windows.
3. Сертификат подходит для Authenticode и входит в доверенную цепочку Microsoft.
4. eSigner CKA совместим с Windows certificate store и `signtool.exe`; известен RFC 3161 timestamp endpoint.
5. При продлении можно сохранить прежнюю подписывающую идентичность.

Закрытый ключ должен оставаться на HSM или аппаратном токене. Не экспортировать его в проект, не отправлять в мессенджерах и не хранить PIN/TOTP в скриптах.

EV не нужен специально ради SmartScreen: с 2024 года он не даёт мгновенного обхода предупреждений. Самоподписанный сертификат пригоден только для локального теста, но не для публичного релиза.

Azure Artifact Signing не выбран как основной маршрут из-за географических ограничений сервиса. Microsoft Store с MSIX можно рассмотреть отдельно как долгосрочный канал распространения; это не заменяет подготовленную здесь подпись NSIS.

Официальные сведения:

- [Варианты подписания Windows-приложений](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options)
- [Репутация Microsoft Defender SmartScreen](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation)
- [Timestamp для Authenticode](https://learn.microsoft.com/en-us/windows/win32/seccrypto/time-stamping-authenticode-signatures)
- [SSL.com IV/OV Code Signing](https://www.ssl.com/products/software-integrity/code-signing/)
- [Интеграция eSigner CKA](https://www.ssl.com/how-to/integrating-esigner-with-ci-cd-pipelines-a-complete-setup-and-configuration-guide/)

## 2. Подключить eSigner или токен и найти издателя

Для eSigner установить CKA по инструкции SSL.com, настроить учётную запись и двухфакторную аутентификацию в защищённом кабинете, затем выполнить `eSignerCKATool.exe load`. Учётные данные и TOTP-секрет в проектные скрипты не вносить. Для физического токена установить драйвер поставщика и подключить токен.

В PowerShell найти сертификат:

```powershell
Get-ChildItem Cert: -Recurse -CodeSigningCert |
  Where-Object { $_.NotAfter -gt (Get-Date) -and $_.HasPrivateKey } |
  Select-Object Subject, Thumbprint, NotAfter, PSParentPath
```

Скопировать **полные значения `Subject` и `Thumbprint`** нужного сертификата. Отпечаток особенно важен, если после продления в хранилище одновременно находятся два сертификата с одинаковым Subject.

## 3. Собрать новый подписанный релиз

Сначала повысить `version` в `package.json` через штатный release-процесс. Не публиковать подписанную сборку под номером `0.8.1`.

В PowerShell из каталога `director`:

```powershell
$env:BAIAGENT_WIN_CERT_SUBJECT = 'CN=ТОЧНЫЙ SUBJECT ИЗ СЕРТИФИКАТА'
$env:BAIAGENT_WIN_CERT_SHA1 = '40-СИМВОЛЬНЫЙ ОТПЕЧАТОК БЕЗ ПРОБЕЛОВ'
$env:BAIAGENT_WIN_TIMESTAMP_URL = 'http://ts.ssl.com'
npm run dist:win:signed
```

Для другого удостоверяющего центра использовать выданный им RFC 3161 endpoint. Если `BAIAGENT_WIN_TIMESTAMP_URL` не задан, применяется `http://timestamp.digicert.com`.

Preflight выполняется автоматически до Vite-сборки. Его можно запустить отдельно:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\check-windows-signing.ps1
```

Не задавать `BAIAGENT_WINDOWS_OUTPUT=release` для этой процедуры: отдельный `release-signed` защищает предыдущие артефакты от перезаписи. При необходимости PIN вводится только в защищённом диалоге токена.

## 4. Обязательно проверить артефакты

Подставить новый номер версии в имя установщика:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass `
  -File .\scripts\verify-windows-signature.ps1 `
  -ExpectedSubject $env:BAIAGENT_WIN_CERT_SUBJECT `
  -ExpectedThumbprint $env:BAIAGENT_WIN_CERT_SHA1 `
  -Path '.\release-signed\win-unpacked\BAIagent Director.exe', '.\release-signed\BAIagent-Director-Setup-Windows-<VERSION>-x64.exe'
```

Команда должна завершиться без ошибки и для каждого файла показать:

- `Valid: True`;
- `Status: Valid`;
- `SignatureType: Authenticode`;
- заполненные `Subject`, `Thumbprint` и `TimestampSubject`;
- SHA-256 файла.

Затем провести обычный smoke-тест упакованного приложения и чистую установку/удаление. Успешная подпись не заменяет функциональные тесты.

## 5. Выпустить отдельную версию

Публикация выполняется только после явного решения владельца:

1. Поместить подписанный установщик новой версии в релизный каталог сайта.
2. Обновить `public/downloads/current.json`, копию в `dist/downloads/` и `SHA256SUMS` по фактическому подписанному файлу.
3. Загрузить релиз на сервер штатным способом, не меняя предыдущие публичные файлы задним числом.
4. Скачать установщик заново по публичной HTTPS-ссылке и повторить `verify-windows-signature.ps1` уже для скачанного файла.
5. Сверить его SHA-256 с `current.json` и проверить запуск на чистой Windows-машине без токена.

## Что изменится для пользователя

Подпись даст проверяемое имя издателя и защиту целостности файла. Однако **первый подписанный релиз всё равно может получить предупреждение SmartScreen**: репутация нового файла и издателя накапливается постепенно. Точного порога и гарантированного срока Microsoft не публикует.

Чтобы репутация переносилась между версиями, каждый релиз нужно подписывать одной и той же идентичностью, не менять файл после подписи и всегда добавлять RFC 3161 timestamp. Timestamp сохраняет проверяемость подписи после истечения сертификата.
