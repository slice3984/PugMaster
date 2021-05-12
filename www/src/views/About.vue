<template>
  <div id="wrapper">
    <div class="features">
      <div class="features__heading">Features</div>
      <div class="features__content">
        <div class="features__left">
          <ul>
            <li>Up to 100 player pickups with up to 10 teams</li>
            <li>Command based permission system</li>
            <li>Customizable dm, start & sub messages</li>
            <li>AFK check system</li>
            <li>Map vote system</li>
            <li>
              Trueskill rating system
              <ul>
                <li>Individual ratings per pickup</li>
                <li>Ability for captains to report losses and draws</li>
                <li>Ability to rate, unrate & rerate pickups as admin</li>
              </ul>
            </li>
            <li>
              Top lists / pickup history & individual player
              <base-link to="/stats" mode="bold">stats</base-link>
            </li>
          </ul>
        </div>
        <div class="features__divider"></div>
        <div class="features__right">
          <ul>
            <li>
              Multiple pick modes
              <ul>
                <li>No teams</li>
                <li>Random teams</li>
                <li>Manual discord picking with captain system</li>
                <li>Rating based generated teams</li>
                <li>Rating or manual auto mode</li>
              </ul>
            </li>
            <li>
              Ban & warns system
              <ul>
                <li>Role based allowlist / denylist system</li>
                <li>Ban command for timed or permanent bans</li>
                <li>Streak based warn system</li>
              </ul>
            </li>
          </ul>
        </div>
      </div>
      <div class="github">
        <div class="github__heading">Source</div>
        <div class="github__content">
          <base-icon width="5rem" height="5rem" icon="github"></base-icon>
          <base-link
            mode="bold"
            link
            to="https://github.com/slice3984/pickup-bot"
            target="_blank"
            >Github Repository</base-link
          >
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";

export default defineComponent({});
</script>

<style lang="scss" scoped>
#wrapper {
  display: flex;
  justify-content: center;
  padding-top: 5rem;
}

.features {
  font-size: 1.75rem;

  &__heading {
    text-align: center;
    margin-bottom: 2rem;
    font-size: 2.5rem;
  }

  &__divider {
    display: inline-block;
    min-height: 100%;
    width: 1px;
    margin: 0 2.5rem;
    background-color: rgba($purple, 0.1);
  }

  &__content {
    display: flex;
    justify-content: space-around;

    & ul {
      list-style-position: inside;

      & li ul li {
        margin-left: 2rem;
      }
    }
  }
}

.github {
  margin-top: 2rem;

  &__heading {
    text-align: center;
    margin-bottom: 1rem;
    font-size: 2.5rem;
  }

  &__content {
    display: flex;
    justify-content: center;
    align-items: center;

    & svg {
      margin-right: 1rem;
    }
  }
}

ul li {
  margin-bottom: 1.5rem;
}

ul li ul:first-child {
  margin-top: 1rem;
}
</style>
