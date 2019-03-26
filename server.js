/* eslint-disable func-names */
const net = require('net');

const users = [];

const blockedUsers = [];

const adminUsers = [];

function ensureAT(name) {
  return !(name = name.trim()).startsWith('@') ? `@${name}` : name;
}

function echo(stack, data) {
  let name;
  let socket;
  [{name, socket}, data] = typeof stack === 'string' ? [data ? {name: 'bot'} : {}, stack] : [stack, data];
  data = data.toString().trimEnd();
  const echoData = `${name ? `<\x1b[32m${name}\x1b[0m>: ` : ''}${data}\r\n`;
  users.forEach(user => user.socket !== socket && user.socket.write(echoData));
}

function getUserStackFromName(name) {
  return users.find(stack => stack.name === ensureAT(name));
}

function hasUser(name, stack = users) {
  return stack.map(user => user.name).includes(ensureAT(name));
}

function directMsg(from, to, data) {
  const stack = getUserStackFromName(to);
  if (!stack) return;
  if (!hasUser(from.name)) from.socket.write(`The sending user was unidentified in our userstack`);
  if (!hasUser(stack.name)) from.socket.write(`The recieving user was unidentified in our userstack`);
  stack.socket.write(`<\x1b[32m${from.name}\x1b[0m -> \x1b[34m${stack.name}\x1b[0m>: ${data}\r\n`);
}

function findAndRemoveStack(stack) {
  [users, blockedUsers, adminUsers].forEach(pack => {
    let index;
    if (~(index = pack.indexOf(stack))) pack.splice(index, 1);
  });
}

function padUp(buffer, callback) {
  if (typeof buffer === 'function') [buffer, callback] = [Buffer.alloc(0), buffer];
  return function dataListener(data) {
    data = data.toString();
    const trimmed = data.trim();
    const res = (buffer = Buffer.concat([buffer, Buffer.from(trimmed || (data.includes(' ') ? ' ' : ''))]));
    if (data.endsWith('\r\n') || data.endsWith('\n') || data.endsWith('\r')) (buffer = Buffer.alloc(0)), callback(res);
  };
}

function sudo(stack, action) {
  if (typeof stack === 'function') [stack, action] = [, stack];
  if (adminUsers.includes(stack)) action.call(stack);
  else {
    stack.socket.removeListener('data', stack.dataListener);
    stack.socket.write('Please input root admin password: ');
    stack.socket.once(
      'data',
      padUp(function listener(data) {
        stack.socket.on('data', stack.dataListener);
        Buffer.from(data.toString()).toString('hex') === '723030743a643376'
          ? action.call(stack)
          : stack.socket.write('\x1b[31m[!]\x1b[0m Failed!, You have no right to use this feature :-)\r\n');
      }),
    );
  }
}

function callCommand(cmdName, stack, ...args) {
  // eslint-disable-next-line no-use-before-define
  commands[cmdName][1].apply(stack, args);
}

const commands = {
  bye: [
    'Alias for .logout',
    function() {
      callCommand('logout', this);
    },
  ],
  exit: [
    'Alias for .logout',
    function() {
      callCommand('logout', this);
    },
  ],
  help: [
    'Alias for .commands',
    function() {
      callCommand('commands', this);
    },
  ],
  list: [
    'List all users, blocked or not',
    function() {
      this.socket.write(
        `Userlist:\r\n${users.map(({name}) => ` - ${name} ${hasUser(name, adminUsers) ? '[admin]' : ''}`).join('\r\n')}\r\n`,
      );
      if (blockedUsers.length)
        this.socket.write(`Blocked Users:\r\n${blockedUsers.map(({name}) => ` - ${name}`).join('\r\n')}\r\n`);
    },
  ],
  logout: [
    'Logout from the group',
    function() {
      this.logout = true;
      const rm = () => {
        findAndRemoveStack(this);
        this.socket.removeListener('data', this.dataListener);
        echo(`Logging out [${this.name}]...done`, true);
      };
      // eslint-disable-next-line no-underscore-dangle
      if (this.socket._writableState.ended || this.socket._writableState.destroyed) rm();
      else rm(), this.socket[this.socket !== process.stdout ? 'end' : 'write'](`You have been logged out\r\n`);
    },
  ],
  commands: [
    'List all group commands',
    function() {
      this.socket.write(
        `Available Commands:\r\n${Object.entries(commands)
          .map(([cmd, [desc]]) => ` - \x1b[33m.${cmd}\x1b[0m\n    => \x1b[35m${desc}\x1b[0m`)
          .join('\r\n')}\r\n`,
      );
    },
  ],
  block: [
    'Block a user from receiving or sending messages (admin only)',
    function(name) {
      sudo(this, function() {
        name = ensureAT(name);
        if (!hasUser(name, users) && !hasUser(name, blockedUsers))
          return this.socket.write(`The user [${name}] does not exist in this group\r\n`);
        if (hasUser(name, blockedUsers)) return this.socket.write(`The user [${name}] is already blocked`);
        return blockedUsers.push(users.splice(users.indexOf(getUserStackFromName(name)), 1).pop());
      });
    },
  ],
  unblock: [
    'Unblock a user if already blocked (admin only)',
    function(name) {
      sudo(this, function() {
        name = ensureAT(name);
        if (!hasUser(name, users) && !hasUser(name, blockedUsers))
          return this.socket.write(`The user [${name}] does not exist in this group\r\n`);
        if (hasUser(name, users)) return this.socket.write(`The user [${name}] is not blocked`);
        return users.push(blockedUsers.splice(users.indexOf(getUserStackFromName(name)), 1).pop());
      });
    },
  ],
  makeadmin: [
    'Grant administrator permissions to the user (admin only)',
    function(name) {
      sudo(this, function() {
        const stack = getUserStackFromName(name || this.name);
        if (stack) {
          if (!adminUsers.includes(stack))
            adminUsers.push(stack),
              echo(
                `<\x1b[32mbot\x1b[0m> ${
                  this === stack ? `Authentication granted` : `${this.name} just made ${stack.name} an administrator`
                }`,
              );
          else this.socket.write(`This user is already an admin\r\n`);
        } else if (hasUser(name, blockedUsers)) this.socket.write(`This user can't be elevated while being blocked\r\n`);
        else this.socket.write(`This user doesn't exist\r\n`);
      });
    },
  ],
  revokeadmin: [
    'Revoke administrator permissions to a user (admin only)',
    function(name) {
      sudo(this, function() {
        const stack = getUserStackFromName(name || this.name);
        if (stack) {
          if (adminUsers.includes(stack))
            adminUsers.splice(adminUsers.indexOf(stack), 1),
              echo(`<\x1b[32mbot\x1b[0m> ${this.name} just revoked ${stack.name}'s administrator permissions`);
          else this.socket.write(`This user is currently not an admin\r\n`);
        } else if (hasUser(name, blockedUsers)) this.socket.write(`This user can't be downgraded while being blocked\r\n`);
        else this.socket.write(`This user doesn't exist\r\n`);
      });
    },
  ],
  shutdown: [
    'Shutdown the chat server (admin only)',
    function(quit) {
      const fn = function() {
        process.stdout.cursorTo(0);
        process.stdout.clearLine();
        echo(`[${this.name || '@root'}] has initiated a server shutdown`, true);
        echo({name: 'session'}, 'Logging out users...');
        [...users, ...blockedUsers].reverse().forEach(user => callCommand('logout', user));
        return process.exit();
      };
      quit === true ? fn() : sudo(this, fn);
    },
  ],
};

function getUsers() {
  return users.map(user => user.name);
}

function addUser(name, socket, admin) {
  const stack = {name, socket};
  users.push(stack);
  if (admin) adminUsers.push(stack);
  echo(`[${name}] has joined our group`, true);
  socket.write(`Welcome to the group, ${name}. Feel free to say hi\r\n`);
  stack.dataListener = padUp(data => {
    if (hasUser(name, blockedUsers)) return;
    data = data.toString();
    let parsed = data.match(/\.(\w+)(?:\s*(.+))?/);
    if (parsed && parsed[1] in commands) callCommand(parsed[1], stack, ...(parsed[2] || '').split(/\s/g));
    else if (data) {
      if ((parsed = data.match(/^@([^\s]+)\s+(.+)/)) && getUsers().includes(ensureAT(parsed[1])))
        directMsg(stack, parsed[1], parsed[2]);
      else echo(stack, data);
    }
  });
  const logout = () => {
    if (stack.logout) return;
    callCommand('logout', stack);
  };
  socket
    .on('data', stack.dataListener)
    .once('end', logout)
    .once('error', logout);
}

function processAddUser(name, socket) {
  const cb = admin => addUser(name, socket, admin);
  name === '@root' ? sudo({socket}, cb.bind(null, true)) : cb();
}

const server = new net.Server(function connected(socket) {
  socket.write('What is your name? ');
  const fn = padUp(data => {
    const name = ensureAT(
      `${data
        .toString()
        .trim()
        .replace(/\s/g, '_')
        .toLowerCase()}`,
    );
    if (name) {
      if (hasUser(name, users) || hasUser(name, blockedUsers))
        socket.write('This username is chosen, please select another!\r\n');
      else return processAddUser(name, socket), socket.removeListener('data', fn);
    }
    return socket.end();
  });
  socket.on('data', fn).once('error', () => {});
});

server.listen(8888, () => {
  console.log('Server is live on port 8888');
  console.log('Waiting for user connection');
  addUser('@root', process.stdout, true);
});

server.on('error', () => {});

process.once('SIGINT', () => {
  commands.shutdown[1](true);
});
