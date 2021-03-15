<template>
  <header>
    <h1>PickupBot</h1>
    <nav>
      <base-link to="/">Home</base-link>
      <base-link to="/stats">Stats</base-link>
      <base-link to="/commands">Commands</base-link>
      <base-link to="/help">Help</base-link>
      <base-link to="/about">About</base-link>
    </nav>
  </header>
</template>

<script lang="ts">
import { defineComponent } from "vue";

export default defineComponent({});
</script>

<style lang="scss" scoped>
header {
  color: #fff;
  background-color: $dark;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 2rem;

  & h1 {
    font-size: 2.5rem;
  }
}

nav {
  display: flex;

  & a {
    color: #fff;
    display: block;
    padding: 1rem 0 !important;
    font-size: 2rem;

    &:not(:last-child) {
      margin-right: 2rem;
    }
  }
}
</style>
