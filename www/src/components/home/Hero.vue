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
    <div id="links">
      <base-link link to="#" target="_blank" class="link link--invite"
        >Invite to your Server</base-link
      >
      <base-link
        link
        to="https://discord.gg/GeBz3jeU4x"
        target="_blank"
        class="link link--join"
        >Join our Discord</base-link
      >
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

#links {
  text-align: center;

  & h2 {
    font-size: 2.5rem;
  }

  & a {
    font-size: 2rem;
  }

  & .link {
    color: $white;
    padding: 1rem;
    border-radius: 3px;
    margin-right: 1rem;

    &:hover {
      transition: all 200ms;
    }

    &--invite {
      background-color: $blue;
      &:hover {
        background-color: $blue-2;
      }
    }

    &--join {
      background-color: $red-2;
      &:hover {
        background-color: darken($red-2, 5);
      }
    }
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