# Настройка SSH для GitHub

## Проблема
Git не может подключиться к GitHub через SSH: `Permission denied (publickey)`

## Решение

### Вариант 1: Добавить существующий ключ в ssh-agent

```bash
# Запустить ssh-agent
eval "$(ssh-agent -s)"

# Добавить ключ
ssh-add ~/.ssh/id_ed25519_personal

# Проверить, что ключ добавлен
ssh-add -l

# Проверить подключение к GitHub
ssh -T git@github.com
```

### Вариант 2: Настроить SSH config для GitHub

Создайте или отредактируйте файл `~/.ssh/config`:

```bash
nano ~/.ssh/config
```

Добавьте:

```
Host github.com
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519_personal
    IdentitiesOnly yes
```

Затем проверьте:
```bash
ssh -T git@github.com
```

### Вариант 3: Добавить ключ в GitHub (если его там нет)

1. Скопируйте публичный ключ:
```bash
cat ~/.ssh/id_ed25519_personal.pub | pbcopy
```

2. Откройте GitHub → Settings → SSH and GPG keys
3. Нажмите "New SSH key"
4. Вставьте ключ и сохраните

### Вариант 4: Создать новый SSH ключ

Если существующие ключи не работают:

```bash
# Создать новый ключ
ssh-keygen -t ed25519 -C "your_email@example.com" -f ~/.ssh/id_ed25519_github

# Добавить в ssh-agent
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519_github

# Скопировать публичный ключ
cat ~/.ssh/id_ed25519_github.pub | pbcopy

# Добавить в GitHub (Settings → SSH and GPG keys → New SSH key)
```

Затем настройте SSH config:
```bash
nano ~/.ssh/config
```

Добавьте:
```
Host github.com
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519_github
    IdentitiesOnly yes
```

## После настройки

Проверьте подключение:
```bash
ssh -T git@github.com
```

Должно появиться: `Hi Tipo-Agency! You've successfully authenticated...`

Теперь `npm run push` должен работать!
