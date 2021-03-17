<template>
  <div class="help-article">
    <div class="help-article__header">
      <h1><slot name="title"></slot></h1>
    </div>
    <div class="help-article__content">
      <slot></slot>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";

export default defineComponent({});
</script>

<style lang="scss">
.help-article {
  &__red {
    color: $red;
  }

  &__type {
    display: inline-block;
    color: $white;
    font-weight: 600;
    width: 9rem;
    text-align: center;
    border-radius: 0.25rem;
    padding: 0.25rem 1rem;

    &--string {
      background-color: $red;
      color: $white;
    }

    &--number {
      background-color: $blue;
    }

    &--bool {
      background-color: $green;
    }

    &--mention {
      background-color: $red-2;
    }

    &--time {
      background-color: $orange;
    }
  }

  &__table {
    width: 100%;

    & tbody:before {
      content: "-";
      display: block;
      line-height: 0.5em;
      color: transparent;
    }

    & thead {
      text-align: left;
    }
  }

  &__section {
    margin-bottom: 3rem;
  }

  &__block {
    margin-bottom: 2rem;
  }

  &__header {
    & h1 {
      display: inline-block;
      font-size: 3rem;
      border-top: 2px solid $dark;
      margin-bottom: 1rem;
    }
  }

  &__content {
    font-size: 1.7rem;
    line-height: 2rem;

    h2 {
      font-size: 2rem;
      margin-bottom: 0.5rem;
    }
  }
}
</style>