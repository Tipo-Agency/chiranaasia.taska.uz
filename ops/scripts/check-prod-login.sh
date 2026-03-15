#!/usr/bin/expect -f
set timeout 30
set host $env(SERVER_HOST)
set user $env(SERVER_USER)
set password $env(SERVER_SSH_PASSWORD)
set path $env(SERVER_PATH)

if { $host == "" || $user == "" || $password == "" || $path == "" } {
  puts "Missing env vars: SERVER_HOST, SERVER_USER, SERVER_SSH_PASSWORD, SERVER_PATH"
  exit 1
}

spawn ssh $user@$host
expect "password:"
send "$password\r"
expect "# "
send "cd $path\r"
expect "# "
send "cat .env.local 2>/dev/null || echo 'Файл .env.local не найден'\r"
expect "# "
send "grep -r 'MOCK_USERS\\|admin' apps/web/constants.ts 2>/dev/null | head -5\r"
expect "# "
send "grep -r 'TODO\\|FIXME' . 2>/dev/null | head -20\r"
expect "# "
send "exit\r"
expect eof

