# Как собрать ALPHA.apk

Я подготовил проект: добавил Capacitor (`capacitor.config.ts`, зависимости в
`package.json`) и GitHub Actions workflow, который сам всё соберёт.
Сам скомпилировать `.apk` я не могу — для этого нужны Android SDK и Gradle,
доступа к которым у меня в этой среде нет. Есть два рабочих способа сделать
это дальше — выберите тот, что удобнее.

## Способ 1 — GitHub Actions (ничего не ставить на компьютер) ⭐ рекомендую

1. Создайте пустой репозиторий на GitHub и залейте туда содержимое этой папки
   (`ALPHA`) — включая скрытую папку `.github`.
2. (Опционально) Если используете Firebase — добавьте 6 переменных из
   `.env.example` в **Settings → Secrets and variables → Actions** репозитория
   с точно такими же именами (`VITE_FIREBASE_API_KEY` и т.д.). Если не
   добавить — приложение всё равно соберётся, но авторизация Firebase
   работать не будет.
3. Откройте вкладку **Actions** в репозитории. Workflow «Build Android APK»
   запустится автоматически после пуша (или нажмите «Run workflow» вручную).
4. Через 3-5 минут в конце выполнения появится артефакт **ALPHA-debug-apk** —
   скачайте его, внутри будет `app-debug.apk`. Это готовый файл для установки
   на телефон.

Это debug-сборка (подписана debug-ключом) — подходит для тестирования и
установки «вручную». Для публикации в Google Play нужна релизная подпись
(см. ниже).

## Способ 2 — Локально на своём компьютере

Нужно установить:
- Node.js 20+
- Android Studio (даёт Android SDK) или отдельно `cmdline-tools`
- JDK 21

Дальше:

```bash
cd ALPHA
npm install
npm run build
npx cap add android      # создаст папку android/ — как на вашем скриншоте
npx cap sync android
cd android
./gradlew assembleDebug  # соберёт APK
```

Готовый файл появится в:
`android/app/build/outputs/apk/debug/app-debug.apk`

Либо вместо `gradlew` можно открыть папку `android` в Android Studio
(`npm run android:open`) и нажать Run/Build → Build APK.

## Релизная (подписанная) сборка для Google Play

Debug-APK нельзя публиковать в Play Store. Для релиза:

```bash
keytool -genkey -v -keystore alpha-release.keystore -alias alpha -keyalg RSA -keysize 2048 -validity 10000
```

Затем настройте подпись в `android/app/build.gradle` (`signingConfigs`) и
соберите `./gradlew assembleRelease`. Если понадобится — могу подготовить
готовый `build.gradle` с секцией подписи и вторым workflow для релизной
сборки.
