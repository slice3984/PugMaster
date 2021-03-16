<template>
  <h1>History</h1>
</template>

<script lang="ts">
import { rootKey } from "@/store/types";
import { useStore } from "vuex";
import { defineComponent } from "vue";

export default defineComponent({
  props: {
    guildId: {
      type: String,
      required: true,
    },
  },
  setup(props) {
    const store = useStore(rootKey);

    const basicGuildInfo = store.getters["stats/getBasicGuildInfo"](
      props.guildId
    );

    if (!basicGuildInfo) {
      store.dispatch("stats/fetchBasicGuildInfo", props.guildId);
    }
  },
});
</script>
