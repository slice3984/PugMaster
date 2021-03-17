<template>
  <div class="overview" v-if="gotData">
    <div v-if="gotExtendedGuildInfo">
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
import OverviewInfoCard from "@/components/stats/OverviewInfoCard.vue";

export default defineComponent({
  components: { OverviewInfoCard },
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
