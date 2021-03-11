<template>
  <div class="commands-nav-categories">
    <ul>
      <li
        v-for="category in categories"
        :key="category"
        :class="
          activeCategory === category ? 'commands-nav-categories--active' : null
        "
        @click="handleCategorySwitch(category)"
      >
        {{ category }}
      </li>
    </ul>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent } from "vue";

export default defineComponent({
  props: ["activeCategory", "categories"],
  emits: ["category-update"],
  setup(props, ctx) {
    const categories = computed(() => props.categories);
    const activeCategory = computed(() => props.activeCategory);

    const handleCategorySwitch = (category) =>
      ctx.emit("category-update", category);

    return {
      categories,
      activeCategory,
      handleCategorySwitch,
    };
  },
});
</script>

<style lang="scss" scoped>
.commands-nav-categories {
  display: flex;
  justify-content: center;
  margin-bottom: 2rem;
  font-size: 2rem;

  &--active {
    font-weight: 600;
  }

  & ul {
    display: flex;
    list-style: none;

    & li {
      padding: 0.5rem 1rem;
      text-transform: capitalize;
      cursor: pointer;

      &:hover {
        text-decoration: underline;
      }
    }
  }
}
</style>
