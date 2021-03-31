<template>
  <div id="wrapper">
    <div id="info">
      <h1>Multi guild feature-rich discord pickup bot</h1>
      <p>
        Discord bot to organize pickups featuring skill ratings, variable team
        sizes, fine-grained permission system and much
        <base-link mode="bold" to="/about">more.</base-link>
      </p>
    </div>
    <div id="invite">
      <h2>Invite to your server</h2>
      <base-link link to="#">https://discord.gg/123456</base-link>
    </div>
  </div>
</template>

<style lang="scss" scoped>
#wrapper {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

#invite {
  text-align: center;

  & h2 {
    font-size: 2.5rem;
  }

  & a {
    font-size: 2rem;
  }
}

#info {
  text-align: center;
  margin-bottom: 5rem;

  & h1 {
    font-size: 4rem;
  }

  & p {
    font-size: 2rem;
  }
}
</style>