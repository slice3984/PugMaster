<template>
  <div class="overview" v-if="gotData">
    <div v-if="gotExtendedGuildInfo">
      <div class="overview__left">
        <overview-info-card
          class="overview__info"
          :name="extendedGuildInfo.guildName"
          :icon="extendedGuildInfo.guildIcon"
          :id="extendedGuildInfo.guildId"
          :member-count="extendedGuildInfo.memberCount"
          :pickup-player-count="extendedGuildInfo.pickupPlayerCount"
          :played-pickups-count="extendedGuildInfo.pickupCount"
          :last-game="extendedGuildInfo.lastGame"
        />
      </div>
      <div class="overview__right">
        <div class="overview__top">
          <played-pickups-chart
            :data="extendedGuildInfo.pickupsChartData"
            class="overview__played-pickups-chart"
          />
          <top-chart
            :amount-data="extendedGuildInfo.topPlayersChartData"
            :rating-data="extendedGuildInfo.topPlayersRatingsChartData"
            class="overview__top-chart"
          ></top-chart>
        </div>
        <div class="overview__bottom">
          <activity-chart
            :timestamps="extendedGuildInfo.activityTimesChartData"
            class="overview__activity-chart"
          ></activity-chart>
        </div>
      </div>
    </div>
    <div v-else>
      <div class="wrapper">
        <h1>No data available</h1>
        <h2>Server found but no pickup activity</h2>
      </div>
    </div>
  </div>
  <div v-else-if="gotData === false">
    <div class="wrapper">
      <h1>Server not found</h1>
      <base-link to="/stats" mode="bold">Go to server search</base-link>
    </div>
  </div>
</template>

<script lang="ts">
import { GuildInfoExtended, rootKey } from "@/store/types";
import { useStore } from "vuex";
import { defineComponent, ref } from "vue";
import OverviewInfoCard from "@/components/stats/overview/OverviewInfoCard.vue";
import PlayedPickupsChart from "@/components/stats/overview/PlayedPickupsChart.vue";
import TopChart from "@/components/stats/overview/TopChart.vue";
import ActivityChart from "@/components/stats/overview/ActivityChart.vue";

export default defineComponent({
  components: { OverviewInfoCard, PlayedPickupsChart, TopChart, ActivityChart },
  props: {
    guildId: {
      type: String,
      required: true,
    },
  },
  setup(props) {
    const store = useStore(rootKey);
    const gotData = ref(null);
    const gotExtendedGuildInfo = ref(null);
    const basicGuildInfo = store.getters["stats/getBasicGuildInfo"](
      props.guildId
    );

    const extendedGuildInfo = ref<GuildInfoExtended>(
      store.getters["stats/getExtendedGuildInfo"](props.guildId)
    );

    if (!basicGuildInfo || !extendedGuildInfo.value) {
      (async () => {
        await store.dispatch("stats/fetchExtendedGuildInfo", props.guildId);
        extendedGuildInfo.value = store.getters["stats/getExtendedGuildInfo"](
          props.guildId
        );

        if (!extendedGuildInfo.value) {
          return (gotData.value = false);
        }

        gotData.value = true;
        gotExtendedGuildInfo.value = extendedGuildInfo.value.gotData;
      })();
    } else {
      gotData.value = true;
      gotExtendedGuildInfo.value = extendedGuildInfo.value.gotData;
    }

    return {
      gotData,
      gotExtendedGuildInfo,
      extendedGuildInfo,
    };
  },
});
</script>

<style lang="scss" scoped>
.overview {
  padding: 2rem 1rem;
  width: 100%;

  & > div {
    display: flex;
    width: 100%;
    height: calc(100vh - 11rem);
  }

  &__top {
    display: flex;
    margin-left: 2rem;
    height: 50%;
    // width: calc(100% - 2rem);
  }

  &__right {
    margin-left: 3rem;
    display: flex;
    flex-grow: 100;
    flex-flow: column;
    width: 100%;
    height: 100%;
  }

  &__bottom {
    height: 95%;
  }

  &__played-pickups-chart {
    width: 40%;
  }

  &__top-chart {
    width: 100%;
  }

  &__activity-chart {
    max-height: 100%;
  }
}

.wrapper {
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
</style>
