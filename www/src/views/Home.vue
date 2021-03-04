<template>
  <container>
    <Hero />
  </container>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import Hero from "@/components/home/Hero.vue";

export default defineComponent({
  components: { Hero },
});
</script>
