<template>
  <div class="last-pickups">
    <router-link
      class="pickup"
      v-for="pickup of playerInfo.lastPickups"
      :key="pickup.id"
      :to="{ name: 'pickups', params: { pickupId: pickup.id } }"
    >
      <div class="pickup__group">
        <div class="pickup__info" :style="{ width: nameWidth }">
          {{ pickup.name }}
        </div>
        <div class="pickup__info" :style="{ width: playersWidth }">
          {{ pickup.players }} Players
        </div>
      </div>
      <div>
        <div class="pickup__date">{{ toLocalDate(pickup.start) }}</div>
      </div>
    </router-link>
  </div>
</template>

<script lang="ts">
import { PlayerStats } from "@/store/types";
import { computed, defineComponent } from "vue";

export default defineComponent({
  props: {
    playerInfo: {
      type: Object as () => PlayerStats,
    },
  },
  setup(props) {
    const nameWidth = computed(
      () =>
        `${Math.max(
          // @ts-ignore
          ...props.playerInfo.lastPickups.map((p) => p.name.length + 1)
        )}rem`
    );

    const playersWidth = computed(
      () =>
        `${Math.max(
          ...props.playerInfo.lastPickups.map(
            (p) => `${p.players} Players`.length + 1
          )
        )}rem`
    );

    const toLocalDate = (dateStr) =>
      new Date(dateStr).toLocaleDateString(undefined, {
        weekday: "short",
        year: "numeric",
        month: "2-digit",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

    return {
      toLocalDate,
      nameWidth,
      playersWidth,
    };
  },
});
</script>

<style lang="scss" scoped>
a {
  text-decoration: none;
  color: $white;
}
.pickup {
  background-color: $dark;
  display: flex;
  align-items: center;
  width: 100%;
  padding: 0.5rem 1rem;
  justify-content: space-between;

  &:hover {
    background-color: darken($dark, 2);
  }

  &:not(:last-child) {
    margin-bottom: 1rem;
  }

  &__group {
    display: flex;
  }

  &__date {
    font-size: 1.25rem;
  }

  &__info {
    font-size: 1.25rem;
    padding: 0.5rem 0.5rem;
    box-sizing: content-box;
    background-color: darken($dark, 4);
    text-align: center;

    &:not(:last-child) {
      margin-right: 1rem;
    }
  }
}
</style>