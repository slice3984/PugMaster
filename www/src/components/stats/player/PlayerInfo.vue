<template>
  <div class="player-info">
    <div class="player-info__box">
      <h2>Stats for {{ playerInfo.name }}</h2>
      <div class="player-info__group">
        <div>ID</div>
        <div>{{ playerInfo.id }}</div>
      </div>
      <div class="player-info__group">
        <div>Played Pickups</div>
        <div>{{ playerInfo.pickupAmount }}</div>
      </div>
      <div class="player-info__group">
        <div>Also played as</div>
        <div>
          <ul>
            <li v-for="name of playerInfo.previousNames" :key="name">
              {{ name }}
            </li>
          </ul>
        </div>
      </div>
      <div class="player-info__block">
        <h2>Last game times</h2>
        <div
          class="player-info__group"
          v-for="pickup of playerInfo.lastPickupTimes"
          :key="pickup.name"
        >
          <div>{{ pickup.name }}</div>
          <div>{{ toLocalDate(pickup.date) }}</div>
        </div>
      </div>
      <div class="player-info__block" v-if="playerInfo.ratings.length">
        <h2>Ratings</h2>
        <div
          class="player-info__group"
          v-for="rating of playerInfo.ratings"
          :key="rating.name"
        >
          <div>{{ rating.name }}</div>
          <div>{{ rating.rating }} ± {{ rating.variance }}</div>
        </div>
      </div>
    </div>
    <div class="player-info__box">
      <h2></h2>
      <div class="player-info__group">
        <div></div>
        <div></div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { PlayerStats } from "@/store/types";
import { defineComponent } from "vue";

export default defineComponent({
  props: {
    playerInfo: {
      type: Object as () => PlayerStats,
    },
  },
  setup(props) {
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
    };
  },
});
</script>

<style lang="scss" scoped>
.player-info {
  &__box {
    width: 100%;

    ul {
      list-style: none;
    }

    h2 {
      font-size: 2rem;
      margin-bottom: 1.5rem;
    }
  }

  &__group {
    display: flex;
    justify-content: space-between;
    font-size: 1.5rem;

    &:not(:last-child) {
      margin-bottom: 0.5rem;
    }
  }

  &__block {
    h2 {
      margin-bottom: 1rem;
    }

    margin-top: 2rem;
  }
}
</style>
