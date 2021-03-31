<template>
  <div v-if="loaded" class="player-stats">
    <div v-if="!knownGuild" class="player-stats__invalid">
      <h1>Server not found</h1>
      <base-link :to="{ name: 'stats-search', params: { guildId: null } }"
        >Back to server search</base-link
      >
    </div>
    <div v-else-if="!gotGuildStats" class="player-stats__invalid">
      <h1>Server found, no pickup activity</h1>
      <base-link :to="{ name: 'stats-search', params: { guildId: null } }"
        >Back to server search</base-link
      >
    </div>
    <div v-else-if="!knownPlayer" class="player-stats__invalid">
      <h1>Unknown player provided</h1>
      <base-link
        :to="{
          name: 'player-search',
          params: { guildId: $route.params.guildId },
        }"
        >Back to player search</base-link
      >
    </div>
    <div v-else class="player-stats__content">
      <div class="player-stats__top">
        <played-pickups-chart
          class="player-stats__pickups-chart"
          :amountData="playedPickupChartData"
        />
      </div>
      <div class="player-stats__center">
        <div class="player-stats__left">
          <player-info :playerInfo="playerStats" />
        </div>
        <div class="player-stats__right">
          <h1>Last 10 played pickups</h1>

          <last-player-pickups :playerInfo="playerStats" />
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { PlayerStats, rootKey } from "@/store/types";
import { useStore } from "vuex";
import { computed, defineComponent, ref } from "vue";
import PlayedPickupsChart from "@/components/stats/player/PlayedPickupsChart.vue";
import PlayerInfo from "@/components/stats/player/PlayerInfo.vue";
import LastPlayerPickups from "@/components/stats/player/LastPlayerPickups.vue";

export default defineComponent({
  components: { PlayedPickupsChart, PlayerInfo, LastPlayerPickups },
  props: {
    guildId: {
      type: String,
      required: true,
    },
    playerId: {
      type: String,
      required: true,
    },
  },
  setup(props) {
    const loaded = ref(false);
    const knownGuild = ref(false);
    const gotGuildStats = ref(false);
    const knownPlayer = ref(false);

    const store = useStore(rootKey);

    let guildPickups = store.getters["players/getGuildPickups"](props.guildId);
    let playerStats = ref<PlayerStats>();

    const playedPickupChartData = computed(() => {
      const data = [];
      playerStats.value.playedPickups
        .sort((a, b) => b.amount - a.amount)
        .forEach((pickup) => {
          data.push({
            name: pickup.name,
            amountServer: guildPickups.find((p) => p.name === pickup.name)
              .amount,
            amountPlayer: pickup.amount,
          });
        });

      return data;
    });

    (async () => {
      let basicGuildInfo = store.getters["stats/getBasicGuildInfo"](
        props.guildId
      );

      if (!basicGuildInfo) {
        await store.dispatch("stats/fetchBasicGuildInfo", props.guildId);
      }

      basicGuildInfo = store.getters["stats/getBasicGuildInfo"](props.guildId);

      if (!basicGuildInfo) {
        loaded.value = true;
        return;
      }

      knownGuild.value = true;

      if (!guildPickups) {
        await store.dispatch("players/fetchGuildPickups", props.guildId);
      }

      guildPickups = store.getters["players/getGuildPickups"](props.guildId);

      if (!guildPickups.length) {
        loaded.value = true;
        return;
      }

      gotGuildStats.value = true;

      let retrievedStats = await store.getters["players/getPlayerStats"](
        props.guildId,
        props.playerId
      );

      if (!retrievedStats) {
        await store.dispatch("players/fetchPlayerStats", {
          guildId: props.guildId,
          playerId: props.playerId,
        });
      }

      retrievedStats = await store.getters["players/getPlayerStats"](
        props.guildId,
        props.playerId
      );

      if (retrievedStats) {
        knownPlayer.value = true;
        playerStats.value = retrievedStats;
      }

      loaded.value = true;
    })();
    return {
      loaded,
      knownGuild,
      gotGuildStats,
      knownPlayer,
      playedPickupChartData,
      playerStats,
    };
  },
});
</script>

<style lang="scss" scoped>
.player-stats {
  &__content {
    display: flex;
    flex-flow: column;
    align-items: center;
    margin: 0 auto;
    margin-top: 3rem;
    width: 50%;
    height: calc(100vh - 10rem);
  }

  &__pickups-chart {
    width: 100%;
    height: 100%;
  }

  &__top {
    width: 100%;
    height: 25%;
  }

  &__invalid {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    color: $gray;

    h1 {
      font-weight: 800;
      font-size: 3rem;
    }

    a {
      font-size: 2rem;
    }
  }

  &__center {
    display: flex;
    margin-top: 5rem;
    width: 100%;
  }

  &__left {
    width: 40%;
    margin-right: 5rem;
  }

  &__right {
    width: 60%;

    & > h1 {
      margin-bottom: 1rem;
    }
  }
}
</style>
