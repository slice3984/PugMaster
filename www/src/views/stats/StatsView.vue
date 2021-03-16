<template>
  <div>
    <div class="top-bar">
      <div class="top-bar__info">
        <div class="top-bar__content">
          <div v-if="basicGuildInfo">
            <h1>Stats for {{ basicGuildInfo.name }}</h1>
          </div>
        </div>
      </div>
      <nav>
        <ul>
          <li>
            <base-link :to="{ name: 'overview' }">Overview</base-link>
          </li>
          <li>
            <base-link :to="{ name: 'history' }">Pickup history</base-link>
          </li>
          <li>
            <base-link :to="{ name: 'player-search' }">Player stats</base-link>
          </li>
        </ul>
      </nav>
    </div>

    <router-view v-slot="{ Component }" :key="fullPath">
      <transition name="route" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>
  </div>
</template>

<script lang="ts">
import { rootKey } from "@/store/types";
import { useStore } from "vuex";
import { computed, defineComponent, onUpdated, ref } from "vue";
import { useRouter } from "vue-router";

export default defineComponent({
  props: {
    guildId: {
      type: String,
      required: true,
    },
  },
  setup(props) {
    const router = useRouter();
    const fullPath = ref(router.currentRoute.value.fullPath);
    const store = useStore(rootKey);

    const basicGuildInfo = computed(() =>
      store.getters["stats/getBasicGuildInfo"](props.guildId)
    );

    if (router.currentRoute.value.name === "stats-view") {
      router.replace({ name: "overview" });
    }

    onUpdated(() => {
      fullPath.value = router.currentRoute.value.fullPath;
    });

    return {
      basicGuildInfo,
      fullPath,
    };
  },
});
</script>

<style lang="scss" scoped>
.top-bar {
  display: flex;
  justify-content: space-between;

  &__content {
    height: 100%;
    width: calc(100% - 43rem);
    display: flex;
    justify-content: center;
    align-items: center;
    margin-left: 2rem;
  }

  &__info {
    color: $white;
    margin-right: -100%;
    background-color: lighten($dark, 10);
    width: 100%;
  }
}

nav {
  width: 40rem;
  padding: 0.5rem 2rem 0.5rem 5rem;
  font-size: 1.5rem;
  background-color: $dark;
  clip-path: polygon(0 0, 100% 0, 100% 100%, 10% 100%);

  & ul {
    list-style: none;
    display: flex;
    justify-content: space-between;

    & li {
      a {
        color: $white;
      }
    }
  }
}
</style>