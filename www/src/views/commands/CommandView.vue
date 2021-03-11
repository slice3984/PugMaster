<template>
  <div>
    <command :commandInfo="commandInfo"></command>
  </div>
</template>

<script lang="ts">
import { useStore } from "vuex";
import { defineComponent, ref } from "vue";
import { rootKey } from "@/store/types";
import Command from "./Command.vue";

export default defineComponent({
  props: ["command"],
  components: { Command },
  setup(props) {
    const store = useStore(rootKey);
    const commandInfo = ref(store.getters["command/getCommand"](props.command));

    if (!commandInfo.value) {
      (async () => {
        await store.dispatch("command/fetchCommand", props.command);
        commandInfo.value = store.getters["command/getCommand"](props.command);
      })();
    }

    return {
      commandInfo,
    };
  },
});
</script>

<style lang="scss" scoped>
</style>
