<template>
  <the-header />
  <router-view v-slot="{ Component }">
    <transition name="route" mode="out-in">
      <component :is="Component" />
    </transition>
  </router-view>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import TheHeader from "@/components/layout/TheHeader.vue";

export default defineComponent({
  components: { TheHeader },
});
</script>

<style lang="scss">
@import url("https://fonts.googleapis.com/css2?family=Roboto:wght@300;400&display=swap");

*,
*::after,
*::before {
  box-sizing: border-box;
  padding: 0;
  margin: 0;
}

html {
  font-size: 62.5%;
  background-color: $background;
}

#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: $white;

  ::-webkit-scrollbar {
    width: 4px;
    height: 4px;
  }
  ::-webkit-scrollbar-button {
    width: 0;
    height: 0;
  }
  ::-webkit-scrollbar-thumb {
    background: $blue;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: $blue-2;
  }
  ::-webkit-scrollbar-thumb:active {
    background: $blue-2;
  }
  ::-webkit-scrollbar-track {
    background: $dark;
    border-radius: 50px;
  }

  ::-webkit-scrollbar-corner {
    background: transparent;
  }
}

.route-enter-from,
.route-leave-to {
  opacity: 0;
}

.route-enter-active {
  transition: all 200ms ease-out;
}

.route-leave-active {
  transition: all 200ms ease-in;
}

.route-enter-to,
.route-leave-from {
  opacity: 1;
}

.router-link-active,
.router-link-exact-active {
  font-weight: 600;
}
</style>
