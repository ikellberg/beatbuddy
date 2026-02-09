# US-015: RunnerLocation — переход на спрайты

## Acceptance Criteria

1. Герой — AnimatedSprite дино с корректной сменой анимаций (run/jump/dead)
2. Фон — TilingSprite, скроллится с параллаксом
3. Земля — TilingSprite из тайлов, скроллится с полной скоростью
4. Препятствия — Sprite из ассетов (камень, ящик, куст, гриб)
5. Игровая логика идентична: perfect→прыжок, miss→спотыкание, auto-stumble работает
6. Нет видимых артефактов при загрузке (спрайты появляются до первого бита)
7. 5x start/stop — нет утечек памяти, нет визуальных провалов
8. Переключение на Default/Forest — без регрессий
9. Рендер >=55 FPS на целевом устройстве

## Context

RunnerLocation рисует всю сцену процедурно через `PIXI.Graphics` (880 строк `drawCircle`/`drawRect`). Результат выглядит как набор кружков и палочек. Переходим на спрайтовый рендеринг с cartoon-ассетами (GameArt2D, CC0): дино-персонаж, фон с горами, тайлы земли, объекты-препятствия.

## Источники ассетов и лицензия

| Пак | Автор | Лицензия | URL |
|-----|-------|----------|-----|
| Free Dino Sprites | GameArt2D | CC0 / Public Domain | https://www.gameart2d.com/free-dino-sprites.html |
| Free Platformer Tileset | GameArt2D | CC0 / Public Domain | https://www.gameart2d.com/free-platformer-game-tileset.html |

Файл `src/web/assets/runner/LICENSE.txt` — фиксирует CC0 и ссылки на источники.

## Ассеты (уже скачаны в /tmp/)

| Ассет | Файлы | Размер | Использование |
|-------|-------|--------|---------------|
| Дино Run | 8 кадров 680x472 | `Run (1..8).png` | AnimatedSprite бега |
| Дино Jump | 12 кадров 680x472 | `Jump (1..12).png` | AnimatedSprite прыжка |
| Дино Dead | 8 кадров 680x472 | `Dead (1..8).png` | AnimatedSprite спотыкания |
| Дино Idle | 10 кадров 680x472 | `Idle (1..10).png` | AnimatedSprite простоя |
| Фон | BG.png 1000x750 | Горы+деревья+небо | TilingSprite с параллаксом |
| Земля (верх) | Tile 2, 128x128 | Трава+грунт | TilingSprite поверхности |
| Земля (низ) | Tile 5, 128x128 | Чистый грунт | TilingSprite заполнения |
| Камень | Stone.png 90x54 | Препятствие type 0 | Sprite |
| Ящик | Crate.png | Препятствие type 1 | Sprite |
| Куст | Bush (1).png 133x65 | Препятствие type 2 | Sprite |
| Гриб | Mushroom_1.png | Препятствие type 3 | Sprite |

## Архитектура: Container-дерево вместо одного Graphics

```
container (stage от Animator)
├── bgContainer
│   ├── skyGraphics           (Graphics — градиент неба, солнце)
│   ├── bgTiling              (TilingSprite — BG.png, параллакс 0.1x)
│   └── cloudsGraphics        (Graphics — облака)
├── groundContainer
│   ├── groundTiling          (TilingSprite — тайл 2, полная скорость)
│   ├── dirtTiling            (TilingSprite — тайл 5, заполнение вниз)
│   └── groundOverlay         (Graphics — травинки)
├── obstacleContainer
│   └── obstacleSprites[0..9] (Sprite пул, visible toggle)
├── heroContainer
│   ├── heroShadow            (Graphics — эллипс тени)
│   └── heroSprite            (AnimatedSprite — дино)
└── effectsGraphics           (Graphics — кольца, частицы, тряска)
```

## Что меняется / что остаётся

| Элемент | Было | Станет |
|---------|------|--------|
| Небо + солнце | Graphics | **Graphics** (оставляем) |
| Облака | Graphics | **Graphics** (оставляем) |
| Горы (3 слоя) | Graphics bezier | **Убираем** — заменяет BG.png |
| Задние деревья | Graphics | **Убираем** — заменяет BG.png |
| Земля | Graphics rect | **TilingSprite** тайлы |
| Травинки | Graphics bezier | **Graphics** (оставляем) |
| Цветы | Graphics | **Убираем** — упрощение |
| Препятствия | Graphics drawEllipse | **Sprite пул** |
| Герой | Graphics 80+ вызовов | **AnimatedSprite** |
| Эффекты/частицы | Graphics | **Graphics** (оставляем) |
| Игровая логика | JS state machine | **Без изменений** |

## Шаги реализации

### Шаг 1. Подготовка ассетов
- Копировать PNG из `/tmp/` в `src/web/assets/runner/`
- Переименовать: `Run (1).png` → `run-1.png` (URL-safe)
- Структура:
  ```
  src/web/assets/runner/
  ├── character/   run-{1..8}.png, jump-{1..12}.png, dead-{1..8}.png, idle-{1..10}.png
  ├── backgrounds/ bg.png
  ├── tileset/     ground-top.png (tile 2), ground-fill.png (tile 5)
  └── obstacles/   stone.png, crate.png, bush.png, mushroom.png
  ```

### Шаг 2. RunnerAssets.js — манифест ассетов
- **Новый файл:** `src/web/js/locations/RunnerAssets.js`
- Экспортирует `getTextures()` → кэшированные PIXI.Texture для всех ассетов
- `Texture.from(url)` — синхронный вызов, изображение грузится фоново
- **Preload guard:** `preloadAll()` → Promise, загружает все текстуры через `PIXI.Assets.load()`
- В `onBeat`: пока `assetsReady === false` → рисуем только процедурные слои (небо, земля цветом), спрайты не показываем
- Текстуры **shared** — `getTextures()` кэширует на уровне модуля, при `destroy()` НЕ уничтожаются (переиспользуются при повторном start)
- `clearCache()` вызывается только при полном уничтожении приложения (не при stop/start цикле)
- ~60 строк

### Шаг 3. Рефакторинг RunnerLocation.js — init()
- Заменить создание одного `Graphics` на Container-дерево (см. архитектуру выше)
- Создать `AnimatedSprite` героя из текстур бега, `anchor(0.5, 1.0)`
- Масштаб героя: `targetHeight / 472` где targetHeight = `minSide * 0.22`
- Создать TilingSprite для фона и земли
- Создать пул Sprite для препятствий (MAX_OBSTACLES=10)

### Шаг 4. Рефакторинг onBeat() — обновление вместо перерисовки
- **Вместо** `graphics.clear()` + 15 draw-функций
- **Теперь:** обновить позиции существующих объектов:
  - `bgTiling.tilePosition.x = -worldOffset * 0.1`
  - `groundTiling.tilePosition.x = -worldOffset`
  - Перерисовать только Graphics-слои (небо, облака, травинки, эффекты)
  - Переместить/показать/скрыть Sprite препятствий
  - Обновить позицию героя (x, y, rotation)

### Шаг 5. Анимации героя и маппинг препятствий
- Переменная `currentAnim` отслеживает текущую анимацию
- При смене `charState` → `heroSprite.textures = assets.charTextures[newAnim]`
- running → `run` (loop), jumping → `jump` (once), stumbling → `dead` (once)
- `heroSprite.y = pose.y` (включает arc прыжка)
- `heroSprite.rotation = pose.tilt` (наклон при спотыкании)

**Маппинг препятствий (type → текстура/размер):**

| type | Файл | anchor | targetH | Примечание |
|------|-------|--------|---------|------------|
| 0 | stone.png (90x54) | (0.5, 1.0) | minSide * 0.06 | Низкий камень |
| 1 | crate.png (77x77) | (0.5, 1.0) | minSide * 0.08 | Квадратный ящик |
| 2 | bush.png (133x65) | (0.5, 1.0) | minSide * 0.07 | Широкий куст |
| 3 | mushroom.png (58x62) | (0.5, 1.0) | minSide * 0.07 | Высокий гриб |

Все anchor `(0.5, 1.0)` — дно по центру на groundY. Scale = `targetH / texture.height`.

### Шаг 6. onHit() — без изменений логики
- Игровая логика (state machine, эффекты, частицы) **не меняется**
- Только: переключение анимации героя теперь через `_switchHeroAnimation()`

### Шаг 7. destroy() — очистка всех display objects
- Стоп и destroy героя, TilingSprite'ов, всех Sprite из пула
- Destroy контейнеров
- Null всех ссылок
- **Текстуры НЕ уничтожаем** — передаём `false` в `sprite.destroy({texture: false, baseTexture: false})`
- Shared-текстуры живут в кэше RunnerAssets и переиспользуются при следующем start()

### Шаг 8. Удалить мёртвый код
- Убрать: `_drawMountains`, `_drawMountainLayer`, `_drawBackTrees`, `_drawFlowers`
- Убрать: `_drawHero` (заменён AnimatedSprite)
- Убрать: `_drawObstacle`, `_drawShadow` для препятствий
- Убрать: массивы `trees[]`, `flowers[]` из `_seedWorldDecor`

### Шаг 9. Визуальная настройка и тестирование
- Подстроить масштабы (герой, препятствия, фон)
- Проверить тайлинг земли и фона (seamless?)
- Тест: `window.__debugAnimator.onHit({zone:'perfect'})` → прыжок
- Тест: `window.__debugAnimator.onHit({zone:'miss'})` → спотыкание
- Тест: автоспотыкание при пропуске бита
- Тест: start/stop 5 раз → нет утечек, текстуры не пересоздаются
- Тест: переключение на Default/Forest локации → нет регрессий
- Тест: при недоступном WebGL — Animator показывает fallback-статус (существующее поведение, не ломаем)
- Тест: открыть DevTools → Performance → убедиться >=55 FPS
- Тест: первая секунда после start — нет пустых/мигающих спрайтов

## Файлы

| Файл | Действие |
|------|----------|
| `src/web/assets/runner/**/*.png` | Добавить (~35 файлов) |
| `src/web/js/locations/RunnerAssets.js` | **Создать** (~50 строк) |
| `src/web/js/locations/RunnerLocation.js` | **Переписать** (882 → ~550 строк) |
| `src/web/js/Animator.js` | Без изменений |
| `src/web/js/locations/LocationRegistry.js` | Без изменений |
| `src/web/index.html` | Без изменений |

## Что НЕ меняется
- Интерфейс локации (init/onBeat/onHit/destroy)
- Регистрация в LocationRegistry
- Animator.js, app.js
- Игровая логика (state machine, beat tracking, auto-stumble, pools)
- Другие локации (Default, Forest)
