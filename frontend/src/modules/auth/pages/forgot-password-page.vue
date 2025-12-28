<template>
  <div class="min-h-screen bg-black flex flex-col items-center justify-center px-4 py-6 relative overflow-y-auto selection:bg-orange-500/30">
    
    <div class="fixed inset-0 bg-[linear-gradient(to_right,#27272a_1px,transparent_1px),linear-gradient(to_bottom,#27272a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)] opacity-20 pointer-events-none"></div>

    <div class="relative w-full max-w-sm z-10">
      
      <div class="mb-10 text-center flex flex-col items-center">
        <div class="relative group cursor-default mb-6">
          <div class="flex items-center justify-center gap-3">
            <div class="h-[1px] w-6 bg-zinc-800 group-hover:w-10 group-hover:bg-orange-500 transition-all duration-500"></div>
            <span class="text-white font-sans text-2xl font-black tracking-[0.2em] uppercase italic">
              Git<span class="text-orange-500">Mesh</span>
            </span>
            <div class="h-[1px] w-6 bg-zinc-800 group-hover:w-10 group-hover:bg-orange-500 transition-all duration-500"></div>
          </div>
        </div>

        <div class="inline-flex items-stretch border border-zinc-800 bg-zinc-950 shadow-[0_0_15px_rgba(0,0,0,0.5)] overflow-hidden">
            <div class="px-2 py-1 bg-zinc-900 border-r border-zinc-800 flex items-center">
              <span class="text-zinc-500 font-mono text-[9px] uppercase tracking-tighter">System</span>
            </div>
            <div class="px-3 py-1.5 flex items-center gap-2">
                <span class="text-zinc-200 font-mono text-[10px] tracking-tight">root@gitmesh</span>
                <span class="text-zinc-600 font-mono text-[10px]">:</span>
                <span class="text-orange-500 font-mono text-[10px] font-bold">~/recovery</span>
            </div>
        </div>
      </div>

      <div v-if="!success">
        <div class="mb-8">
           <h3 class="text-zinc-100 font-mono text-xs uppercase tracking-[0.2em] mb-2">Initiate_Access_Restoration</h3>
           <p class="text-zinc-500 text-[10px] font-mono uppercase leading-relaxed tracking-wider">
             Protocol: Transmit restoration directives to registered communication endpoint.
           </p>
        </div>

        <el-form
          ref="form"
          :model="model"
          :rules="rules"
          class="form space-y-6"
          label-position="top"
          @submit.prevent="doSubmit"
        >
          <el-form-item :prop="fields.email.name" class="!mb-0">
            <template #label>
              <span class="text-zinc-200 font-mono text-[10px] uppercase tracking-wider">Target_Endpoint (Email)</span>
            </template>
            <el-input
              id="email"
              ref="focus"
              v-model="model[fields.email.name]"
              autocomplete="email"
              type="text"
              placeholder="VOID@GITMESH.DEV"
              class="terminal-input"
            />
            <template #error="{ error }">
               <div class="text-orange-500 text-[10px] font-mono mt-1 leading-none">> ERR: {{ error }}</div>
            </template>
          </el-form-item>

          <div class="space-y-4 pt-2">
            <button
              id="submit"
              type="submit"
              :disabled="loadingPasswordResetEmail"
              class="group w-full bg-orange-600 hover:bg-orange-500 text-black h-11 font-mono text-xs font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-[0.2em] relative overflow-hidden"
            >
              <div class="absolute inset-0 w-full h-full bg-white/10 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
              
              <span v-if="loadingPasswordResetEmail" class="animate-spin w-3 h-3 border-2 border-black border-t-transparent rounded-full"></span>
              <span v-else class="relative z-10 flex items-center gap-2">
                 EXECUTE_TRANSMISSION
              </span>
            </button>

            <div class="flex justify-center">
              <router-link
                :to="{ name: 'signin' }"
                class="text-zinc-500 hover:text-orange-500 text-[10px] font-mono transition-colors uppercase tracking-widest"
              >
                // abort_recovery
              </router-link>
            </div>
          </div>
        </el-form>
      </div>

      <div v-else class="space-y-8">
        <div class="border border-zinc-800 bg-zinc-950 p-6 relative overflow-hidden">
          <div class="absolute inset-x-0 top-0 h-[1px] bg-orange-500/20 animate-[scan_3s_linear_infinite]"></div>
          
          <div class="flex items-start gap-4 mb-6">
            <div class="flex-shrink-0">
              <i class="ri-broadcast-line text-3xl text-orange-500 animate-pulse" />
            </div>
            <div>
              <h3 class="text-white font-mono text-xs uppercase tracking-[0.2em] mb-2">Transmission_Complete</h3>
              <p class="text-zinc-400 text-[10px] font-mono leading-relaxed">
                DATA_PACKET SENT TO: <br/>
                <span class="text-orange-500 mt-1 block tracking-wider">{{ model.email }}</span>
              </p>
            </div>
          </div>
          
          <div class="p-3 bg-zinc-900/50 border border-zinc-800/50 mb-6">
             <p class="text-zinc-500 text-[9px] font-mono uppercase leading-relaxed tracking-tighter">
               Check local spam buffers or request re-transmission if data link fails.
             </p>
          </div>

          <button
            :disabled="loadingPasswordResetEmail"
            class="w-full border border-zinc-800 hover:border-orange-500 text-zinc-400 hover:text-orange-500 h-10 font-mono text-[10px] transition-all uppercase tracking-widest bg-black/50"
            @click="resend()"
          >
            <span v-if="loadingPasswordResetEmail">RE_SYNCING...</span>
            <span v-else>RE_TRANSMIT_DATA</span>
          </button>
        </div>

        <div class="flex justify-center">
          <router-link
            :to="{ name: 'signin' }"
            class="text-zinc-500 hover:text-orange-500 text-[10px] font-mono transition-colors uppercase tracking-widest"
          >
            // return_to_access_gate
          </router-link>
        </div>
      </div>

    </div>
  </div>
</template>

<script>
import { mapGetters, mapActions } from 'vuex';
import { UserModel } from '@/modules/user/user-model';
import Message from '@/shared/message/message';
import { i18n } from '@/i18n';
import AppI18n from '@/shared/i18n/i18n.vue';

const { fields } = UserModel;

export default {
  name: 'AppForgotPasswordPage',
  components: { AppI18n },
  data() {
    return {
      rules: {
        email: fields.email.forFormRules(),
      },
      model: {},
      success: false,
    };
  },

  computed: {
    ...mapGetters('auth', ['loadingPasswordResetEmail']),
    fields() { return fields; },
  },

  methods: {
    ...mapActions('auth', ['doSendPasswordResetEmail']),
    doSubmit() {
      return this.$refs.form
        .validate()
        .then(() => this.doSendPasswordResetEmail(
          this.model.email,
        ))
        .then(() => {
          this.success = true;
          return Promise.resolve();
        });
    },
    resend() {
      this.doSubmit().then(() => {
        Message.success(
          i18n('auth.passwordResetEmailSuccess'),
        );
      });
    },
  },
};
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Inter:wght@400;600;700;900&display=swap');

.font-sans { font-family: 'Inter', sans-serif; }
.font-mono { font-family: 'JetBrains Mono', monospace; }

@keyframes shimmer {
  from { transform: translateX(-100%); }
  to { transform: translateX(100%); }
}

@keyframes scan {
  from { top: 0; }
  to { top: 100%; }
}

:deep(.el-form-item) {
  margin-bottom: 0;
}

:deep(.el-form-item__label) {
  padding-bottom: 4px !important;
  line-height: 1.2 !important;
}

/* COMPACT INPUT STYLES */
:deep(.terminal-input .el-input__wrapper) {
  background-color: #09090b !important;
  box-shadow: 0 0 0 1px #18181b !important;
  border-radius: 0;
  padding: 0px 0px; 
  height: 42px; 
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

:deep(.terminal-input .el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px #27272a !important;
}

:deep(.terminal-input .el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px #ea580c !important;
  background-color: #000000 !important;
}

:deep(.terminal-input .el-input__inner) {
  color: #ffffff; 
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.85rem;
  height: 100%;
  padding-left: 12px;
}

:deep(.terminal-input .el-input__inner::placeholder) {
    color: #3f3f46; 
    text-transform: uppercase;
    font-size: 10px;
    letter-spacing: 0.1em;
}
</style>