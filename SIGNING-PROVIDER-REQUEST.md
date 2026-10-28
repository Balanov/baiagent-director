# Запрос поставщику сертификата для BAIagent Director

## Рекомендуемый заказ после подтверждения доступности

**Основной вариант:** SSL.com Code Signing + eSigner for Code, тариф Tier 1, eSigner CKA на сборочной Windows-машине.

- Если юридического лица/ИП нет: **IV Code Signing**, издателем будет проверенное личное имя.
- Если сертификат оформляется на организацию: **OV Code Signing**, издателем будет проверенное название организации.
- EV для этого приложения не требуется.
- Срок: 1 год до первой проверки всего процесса; более длинный срок рассматривать после успешного выпуска.
- Не выбирать YubiKey, если доступен eSigner: облачный HSM не требует доставки физического токена.

По опубликованным SSL.com на 28 октября 2026 года условиям IV/OV указан от $129/год; eSigner Tier 1 — $20/месяц или $180/год, с пробным периодом 30 дней. Это не итоговая оферта: перед оплатой нужно подтвердить полную стоимость, налоги, доступность для российского заявителя и способ оплаты.

Официальные страницы:

- [IV Code Signing](https://www.ssl.com/products/software-integrity/code-signing/iv/)
- [OV Code Signing](https://www.ssl.com/products/software-integrity/code-signing/ov/)
- [eSigner pricing](https://www.ssl.com/guide/esigner-pricing-for-code-signing/)
- [eSigner CKA integration](https://www.ssl.com/how-to/integrating-esigner-with-ci-cd-pipelines-a-complete-setup-and-configuration-guide/)

## Готовое письмо на английском

**To:** Sales@SSL.com
**Subject:** Code Signing + eSigner for a Russian applicant — eligibility and setup confirmation

Hello,

I am preparing public Windows releases of BAIagent Director, an Electron desktop application distributed as an NSIS installer from https://baiagent.ru/.

I plan to purchase either IV Code Signing (as an individual) or OV Code Signing (as an organization), together with eSigner for Code Tier 1, and use eSigner CKA with electron-builder/signtool.exe on Windows.

Before placing the order, please confirm in writing:

1. Can you currently issue and validate an IV or OV Code Signing certificate for an applicant located in Russia? Please confirm which applicant types and identity documents are accepted.
2. Can the order and eSigner subscription be paid from Russia? Which payment methods are available, and what is the total first-year price including all required fees and taxes?
3. What exact publisher name will appear in the Windows UAC/Authenticode prompt for IV and OV respectively?
4. Is eSigner for Code Tier 1 sufficient for signing both the application EXE and the NSIS installer, including automated signing through eSigner CKA?
5. Does eSigner CKA expose the certificate through the Windows certificate store so it can be selected by Subject and SHA-1 thumbprint?
6. Which RFC 3161 timestamp URL should be used for this setup?
7. What is the expected validation timeline after all documents have been submitted?
8. Can renewal preserve the same publisher identity for Microsoft SmartScreen reputation, and what is the reissue process under the current certificate-validity limits?
9. Are there any regional restrictions or compliance limitations that could prevent issuance, renewal, or use of eSigner in this scenario?

Please do not create an order or charge anything until eligibility, publisher name, and total cost are confirmed.

Thank you.

## Короткая русская версия для реселлера/поддержки

Здравствуйте!

Нужен сертификат Code Signing для публичного Windows-инсталлятора Electron/NSIS. Рассматриваю IV на физическое лицо либо OV на организацию и облачное подписание eSigner for Code с eSigner CKA.

Прошу до оплаты письменно подтвердить:

1. Возможен ли выпуск и прохождение проверки заявителем из России, какие документы потребуются.
2. Доступные способы оплаты и полную стоимость сертификата плюс eSigner на первый год.
3. Точное имя издателя, которое увидит пользователь Windows.
4. Совместимость eSigner CKA с electron-builder и стандартным `signtool.exe` через Windows certificate store.
5. RFC 3161 timestamp URL, сроки проверки и порядок продления с сохранением идентичности издателя.

Заказ и оплату прошу не формировать до подтверждения этих условий.

## Документы и данные, которые подготовит владелец

Не добавлять копии документов в репозиторий или рабочую папку проекта. Передавать их только через защищённый кабинет проверенного поставщика.

### Для IV

- Действующий документ, удостоверяющий личность с фотографией.
- Подтверждение адреса, если его запросит валидатор.
- Телефон и доступ к видео-/голосовой проверке личности.
- Имя в латинской записи точно в той форме, которую поставщик согласует для сертификата.

### Для OV

- Регистрационные данные организации и документы, подтверждающие юридическое существование.
- Подтверждение полномочий заявителя.
- Корпоративный email на домене организации и проверяемый телефон.
- Согласованное юридическое название издателя для сертификата.

## Критерии перехода к оплате

Оплата допустима только после отдельного решения владельца и письменных ответов поставщика:

- выпуск заявителю из России подтверждён;
- итоговая цена и способ оплаты понятны;
- имя издателя согласовано;
- eSigner CKA подтверждён для Windows certificate store и electron-builder/signtool;
- известны timestamp endpoint и процедура продления.
