<template>
  <li :class="isActive">
    <base-link :to="`/help/${id}`">{{ title }}</base-link>
  </li>
</template>

<script lang="ts">
import { computed } from "vue";
import { defineComponent } from "vue";

export default defineComponent({
  props: ["active-link", "title", "id", "section"],
  setup(props) {
    const isActive = computed(() =>
      props["active-link"] === props.id ? "active-help-point" : null
    );

    return {
      isActive,
      title: props.title,
      id: props.id,
    };
  },
});
</script>

<style lang="scss" scoped>
li {
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
}

.active-help-point {
  font-weight: 800;
}
</style>