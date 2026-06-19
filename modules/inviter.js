const createInviteGlobal = async (time, token) => {
  const fetched = (await (await fetch("https://discord.com/api/v9/channels/1470410050844627128/invites", {
    "headers": {
      "authorization": token,
      "content-type": "application/json",
    },
    "body": JSON.stringify({
        max_age: (time || 5) * 60, // in seconds
        max_uses : 1,
        target_type: null,
        temporary: false,
        flags: 0
    }),
    "method": "POST"
  })).json()).code

  if (!fetched) return "unable to create invite"

  return "discord.gg/" + fetched;
}

//bigInvite = createInviteGlobal(7 * 24 * 60)

const createInvite = async (token) => createInviteGlobal(5, token);

module.exports = createInvite;