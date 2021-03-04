<template>
  <header>
    <h1>PickupBot</h1>
    <nav>
      <base-link to="/">Home</base-link>
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
  background-color: $light-gray;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 2rem;
  border-bottom: 1px solid $purple;

  & h1 {
    font-size: 2.5rem;
  }
}

nav {
  & a {
    text-decoration: none;
    font-size: 2rem;

    &:not(:last-child) {
      margin-right: 2rem;
    }
  }
}
</style>
