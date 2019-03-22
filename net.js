const net = require('net');

const users = [];

const blockedUsers = [];

const adminUsers = [];

function ensureAT(name) {
  return !name.startsWith('@') ? `@${name}` : name;
}

function echo(stack, data) {
  let name;
  let socket;
  [{name, socket}, data] = typeof stack === 'string' ? [data ? {name: 'bot'} : {}, stack] : [stack, data];
  data = data.toString().trimEnd();
  const echoData = `${name ? `[\x1b[32m${name}\x1b[0m]: ` : ''}${data}\n`;
  users.forEach(user => user.socket !== socket && user.socket.write(echoData));
}

function getUserStackFromName(name) {
  name = ensureAT(name);
  return users.find(stack => stack.name === name);
}

function hasUser(name, stack = users) {
  return stack.map(user => user.name).includes(name);
}

function directMsg(from, to, data) {
  const stack = getUserStackFromName(to);
  if (!hasUser(from.name)) from.socket.write(`The sending user was unidentified in our userstack`);
  if (!hasUser(stack.name)) from.socket.write(`The recieving user was unidentified in our userstack`);
  stack.socket.write(`[${from.name} -> ${stack.name}]: ${data}\n`);
}

const commands = {
  list() {
    this.socket.write(`Userlist:\n${users.map(({name, buffer}) => ` - ${name} [${buffer}]`).join('\n')}\n`);
    if (blockedUsers.length) this.socket.write(`Blocked Users:\n${blockedUsers.map(({name}) => ` - ${name}`).join('\n')}\n`);
  },
  makeadmin(name) {},
  block(name) {
    if (this.socket && this.name !== '@root') return this.socket.write(`You have no right to use this feature :-)\n`);
    name = ensureAT(name);
    if (!hasUser(name, users) && !hasUser(name, blockedUsers))
      return this.socket.write(`The user [${name}] does not exist within our tables\n`);
    if (hasUser(name, blockedUsers)) return this.socket.write(`The user [${name}] is already blocked`);
    return blockedUsers.push(users.splice(users.indexOf(getUserStackFromName(name)), 1).pop());
    // console.log(blockedUsers.map(user => user.name), users.map(user => user.name));
  },
  unblock(name) {
    if (this.socket && this.name !== '@root') return this.socket.write(`You have no right to use this feature :-)\n`);
    name = ensureAT(name);
    if (!hasUser(name, users) && !hasUser(name, blockedUsers))
      return this.socket.write(`The user [${name}] does not exist within our tables\n`);
    if (hasUser(name, users)) return this.socket.write(`The user [${name}] is not blocked`);
    return users.push(blockedUsers.splice(users.indexOf(getUserStackFromName(name)), 1).pop());
  },
  logout() {
    echo(`Logging out [${this.name}]...done`, true);
    if (this.socket !== process.stdout) this.socket.end(`You have been logged out\n`);
    else process.stdout.removeListener('data', this.dataListener);
    if (hasUser(this.name, users)) users.splice(users.indexOf(this), 1);
    else if (hasUser(this.name, blockedUsers)) blockedUsers.splice(users.indexOf(this), 1);
  },
  commands() {
    this.socket.write(
      `Available Commands:\n${Object.keys(commands)
        .map(cmd => ` - .${cmd}`)
        .join('\n')}\n`,
    );
  },
  help() {
    commands.commands();
  },
  bye() {
    commands.logout.call(this);
  },
  shutdown() {
    if (this.socket && this.name !== '@root') return this.socket.write(`You have no right to use this feature :-)\n`);
    process.stdout.cursorTo(0);
    process.stdout.clearLine();
    echo('Root has initiated a server shutdown', true);
    echo({name: 'session'}, 'Logging out users...');
    users.forEach(user => commands.logout.call(user));
    return process.exit();
  },
};

function padUp(stack, callback) {
  if (typeof stack === 'function') [stack, callback] = [{buffer: Buffer.alloc(0)}, stack];
  return function dataListener(data) {
    const buffer = (stack.buffer = Buffer.concat([stack.buffer, Buffer.from(data.toString().trim())]));
    if (data.toString().endsWith('\n')) (stack.buffer = Buffer.alloc(0)), callback(buffer);
  };
}

function addUser(name, socket, admin) {
  const stack = {name, socket, admin: !!admin, buffer: Buffer.alloc(0)};
  users.push(stack);
  echo(`[${name}] has joined our group`, true);
  socket.write(`Welcome to the group, ${name}. Feel free to say hi\n`);
  stack.dataListener = padUp(stack, data => {
    if (hasUser(name, blockedUsers)) return;
    data = data.toString();
    let parsed = data.match(/\.(\w+)(?:\s*(.+))?/);
    if (parsed && parsed[1] in commands) commands[parsed[1]].call(stack, ...(parsed[2] || '').split(/\s/g));
    else if (data) {
      if ((parsed = data.match(/^@([^\s]+)\s*(.+)/))) directMsg(stack, parsed[1], parsed[2]);
      else echo(stack, data);
    }
  });
  socket.on('data', stack.dataListener).on('end', _socket => {
    users.splice(users.map(user => user.socket).indexOf(_socket), 1);
    echo(`[${name}] just left the group.`, true);
  });
}

function processAddUser(name, socket, admin) {
  if (name === '@root') {
    socket.write('Please input root admin password: ');
    const listener = padUp({buffer: Buffer.alloc(0)}, function listener(data) {
      if (data.toString() === 'r00t:d3v') {
        socket.removeListener('data', listener);
        addUser(name, socket, admin);
      } else {
        socket.write('Please try again!\n');
        socket.write('Please input root admin password: ');
      }
    });
    socket.on('data', listener);
  } else addUser(name, socket, admin);
}

const server = new net.Server(function connected(socket) {
  socket.write('What is your name? ');
  const fn = padUp(data => {
    const name = `@${data
      .toString()
      .replace(/\s/g, '_')
      .toLowerCase()}`;
    if (name) {
      if (hasUser(name)) socket.write('This username is chosen, please select another!\n');
      else return processAddUser(name, socket), socket.removeListener('data', fn);
    }
    return socket.end();
  });
  socket.on('data', fn);
});

server.listen(8888, () => {
  console.log('Server is live on port 8888');
  console.log('Waiting for user connection');
  addUser('@root', process.stdout, true);
});

process.once('SIGINT', commands.shutdown);
