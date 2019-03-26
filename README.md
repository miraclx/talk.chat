# TALK.CHAT

> TCP Chat server built on pure NodeJS.
> Source code for a software talk that didn't hold.
> Had to finish writing the code 😁

## Installing

From source:

``` bash
git clone https://github.com/miraclx/talk.chat.git
```

## Usage

``` bash
cd talk.chat
node server.js
```

## Connection

You can use anything that can keep a TCP connection

``` bash
$ nc localhost 8888
What is your name? 
```

## Features

### Auto root
By default, starting the server automatically logs in the `root` user.
Right there, the process's I/O is linked to the chat server. This user has administrative powers. You can also logout here to login elsewhere.

### Direct private messages

To send direct messages, reference the user like so
```
@michael Hello
```

### Personal Messages

To save personal messages, send a `direct message` to yourself

### Administrator elevation

Admin users can perform certain operations not granted to other users
```
.makeadmin [user]
.revokeadmin [user]
```
Absence of explicit stating of `user` would automatically infer to carry out the operation on the user executing the command

## Commands

* `.bye`: Alias for .logout
* `.exit`: Alias for .logout
* `.help`: Alias for .commands
* `.list`: List all users, blocked or not
* `.logout`: Logout from the service
* `.commands`: List all group commands
* `.block`: Block a user from receiving or sending messages (admin only)
* `.unblock`: Unblock a user if already blocked (admin only)
* `.makeadmin`: Grant administrator permissions to the user (admin only)
* `.revokeadmin`: Revoke administrator permissions to a user (admin only)
* `.shutdown`: Shutdown the chat server (admin only)

## License

[Apache 2.0][license] © **Miraculous Owonubi** ([@miraclx][author-url]) &lt;omiraculous@gmail.com&gt;

[npm]:  https://github.com/npm/npm 'The Node Package Manager'
[license]:  LICENSE 'Apache 2.0 License'
[author-url]: https://github.com/miraclx
